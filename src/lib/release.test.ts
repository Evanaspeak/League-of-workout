/**
 * L'installeur proposé au téléchargement, et ce qu'on fait quand GitHub ne
 * répond pas ce qu'on attend.
 *
 * C'est le bouton principal de la page d'accueil et toute la page de
 * téléchargement. La réponse vient d'un service tiers, donc sa FORME n'est
 * jamais garantie : une release sans exécutable, un champ renommé, une panne
 * d'API. Dans tous ces cas il faut rendre `null` — la page sait alors montrer
 * le lien vers la page des releases, ce qui vaut infiniment mieux qu'un bouton
 * qui télécharge « undefined ».
 */
import { dernierInstalleur, PAGE_RELEASES } from "@/lib/release";

const vraiFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = vraiFetch; });

function repond(corps: unknown, ok = true) {
  return jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(corps) }));
}

const RELEASE = {
  tag_name: "desktop-v0.9.9",
  assets: [
    { name: "latest.yml", browser_download_url: "https://x/latest.yml" },
    { name: "WinOrWorkout-Setup-0.9.9.exe", browser_download_url: "https://x/setup.exe" },
  ],
};

describe("dernierInstalleur", () => {
  it("rend l'exécutable et la version, sans le préfixe interne", async () => {
    globalThis.fetch = repond(RELEASE) as never;
    await expect(dernierInstalleur()).resolves.toEqual({
      url: "https://x/setup.exe", version: "0.9.9",
    });
  });

  /** L'exécutable n'est pas le premier fichier de la release, et ne l'est jamais. */
  it("choisit le .exe parmi les autres fichiers de la release", async () => {
    globalThis.fetch = repond({
      ...RELEASE,
      assets: [
        { name: "setup.exe.blockmap", browser_download_url: "https://x/bm" },
        { name: "WinOrWorkout-Setup.exe", browser_download_url: "https://x/ok.exe" },
      ],
    }) as never;
    await expect(dernierInstalleur()).resolves.toMatchObject({ url: "https://x/ok.exe" });
  });

  it("rend null quand la release ne porte aucun exécutable", async () => {
    globalThis.fetch = repond({ ...RELEASE, assets: [
      { name: "sources.zip", browser_download_url: "https://x/z" },
    ] }) as never;
    await expect(dernierInstalleur()).resolves.toBeNull();
  });

  it("rend null quand il n'y a aucune release", async () => {
    globalThis.fetch = repond({}, false) as never;
    await expect(dernierInstalleur()).resolves.toBeNull();
  });

  it("rend null quand GitHub ne répond pas", async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error("hors ligne"))) as never;
    await expect(dernierInstalleur()).resolves.toBeNull();
  });

  /** Une réponse qui n'a pas la forme attendue ne doit pas faire tomber la page. */
  it("rend null sur une réponse d'une autre forme", async () => {
    globalThis.fetch = repond("bonjour") as never;
    await expect(dernierInstalleur()).resolves.toBeNull();
    globalThis.fetch = repond({ assets: [{ name: "x.exe" }] }) as never;
    await expect(dernierInstalleur()).resolves.toBeNull();
  });

  /**
   * Un tag qu'on ne sait pas lire donne `null` comme VERSION, pas comme
   * installeur : le bouton doit rester cliquable même sans numéro à afficher.
   */
  it("garde l'installeur quand le tag est illisible", async () => {
    globalThis.fetch = repond({ ...RELEASE, tag_name: 42 }) as never;
    await expect(dernierInstalleur()).resolves.toEqual({
      url: "https://x/setup.exe", version: null,
    });
  });

  /** Le lien de secours est celui que GitHub redirige toujours vers la dernière. */
  it("propose une page de secours toujours valable", () => {
    expect(PAGE_RELEASES).toMatch(/^https:\/\/github\.com\/.+\/releases\/latest$/);
  });
});
