import { test, expect, type Page } from "@playwright/test";
import { LANGUES } from "../src/lib/i18n/LocaleContext";

/**
 * Les six langues, sur les écrans qu'un visiteur voit avant d'avoir un compte.
 *
 * Les tests de dictionnaire vérifient que les clés se correspondent ; ils ne
 * peuvent rien dire de ce que la page fait de ces clés. Trois défauts trouvés
 * à la main n'auraient pas été vus autrement : une clé oubliée qui affiche
 * « undefined », un mot allemand trop long qui pousse la page hors de l'écran,
 * et une phrase restée en anglais parce qu'un composant décidait lui-même de
 * la langue. Ce fichier refait ce passage à chaque poussée.
 */

const PAGES = ["/", "/beta", "/login", "/telechargement", "/recuperation"];

/** Ouvre une page dans une langue donnée, écrans d'accueil écartés. */
async function ouvrirEn(page: Page, langue: string, chemin: string) {
  await page.addInitScript(([l]) => {
    try {
      localStorage.setItem("low_locale", l);
      sessionStorage.setItem("splash", "1");
      localStorage.setItem("low_visite", "1");
      localStorage.setItem("low_onboarded", "1");
    } catch { /* stockage refusé : la page s'affichera en anglais, c'est tout */ }
  }, [langue]);
  await page.goto(chemin, { waitUntil: "domcontentloaded" });
  // Le temps que la langue soit lue et que le rendu suive.
  await page.waitForTimeout(800);
}

for (const langue of LANGUES) {
  test.describe(`langue ${langue}`, () => {
    for (const chemin of PAGES) {
      test(`${chemin} s'affiche sans trou ni débordement`, async ({ page }) => {
        await ouvrirEn(page, langue, chemin);

        const texte = await page.evaluate(() => document.body.innerText);
        // Une clé absente rend `undefined`, un objet rendu tel quel donne
        // « [object Object] » : deux traces d'un dictionnaire incomplet.
        expect({ chemin, langue, texte: texte.match(/\bundefined\b|\[object Object\]/g) ?? [] })
          .toEqual({ chemin, langue, texte: [] });

        // Aucune page ne doit défiler horizontalement : c'est ainsi qu'un mot
        // allemand trop long se signale.
        const deborde = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect({ chemin, langue, deborde }).toEqual({ chemin, langue, deborde: false });

        // La page dit bien dans quelle langue elle est : sans quoi un lecteur
        // d'écran la prononcerait avec le mauvais accent.
        expect(await page.evaluate(() => document.documentElement.lang)).toBe(langue);
      });
    }
  });
}

test("la page d'accueil change vraiment de texte d'une langue à l'autre", async ({ browser }) => {
  // Une langue qui retomberait silencieusement sur l'anglais passerait tous
  // les contrôles ci-dessus. Comparer les textes deux à deux la démasque.
  const textes = new Map<string, string>();
  for (const langue of LANGUES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ouvrirEn(page, langue, "/");
    textes.set(langue, await page.evaluate(() => document.body.innerText));
    await ctx.close();
  }
  const identiques: string[] = [];
  for (const [a, texteA] of textes) {
    for (const [b, texteB] of textes) {
      if (a < b && texteA === texteB) identiques.push(`${a} = ${b}`);
    }
  }
  expect(identiques).toEqual([]);
});

/**
 * Les écrans qui demandent un compte, dans les six langues.
 *
 * Ils portent l'essentiel du texte de l'application, et rien ne les couvrait :
 * les contrôles ci-dessus s'arrêtent aux pages publiques. Un compte est créé
 * une fois, par le même chemin qu'un vrai visiteur, puis son état de
 * navigateur sert aux dix-huit visites.
 */
test.describe("écrans connectés", () => {
  test.describe.configure({ mode: "serial" });

  const marque = Date.now().toString(36);
  const COMPTE = { pseudo: `Lang${marque}`, email: `lang-${marque}@example.test` };
  let etat: import("@playwright/test").BrowserContextOptions["storageState"];

  test("ouvrir un compte pour la suite", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
    });
    await page.goto("/beta");
    await page.getByPlaceholder(/pseudo/i).first().fill(COMPTE.pseudo);
    await page.locator('input[type="email"]').first().fill(COMPTE.email);
    await page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first().click();

    const bloc = page.locator(".mono-num").first();
    await bloc.waitFor({ timeout: 20_000 });
    const code = (await bloc.innerText()).trim();

    await page.goto("/login");
    await page.getByPlaceholder(/ton pseudo|your username/i).fill(COMPTE.pseudo);
    await page.getByPlaceholder(/ton code|your code/i).fill(code);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }),
      page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
    ]);
    // L'identifiant sert à désamorcer la modale d'accueil, dont la mémoire est
    // propre au compte : sans lui elle recouvre chaque écran mesuré.
    const moi = await page.request.get("/api/user");
    expect(moi.ok()).toBeTruthy();
    const uid = (await moi.json()).id as string;
    await page.evaluate((u) => {
      try {
        for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
          localStorage.setItem(c, "1");
        }
      } catch { /* stockage refusé */ }
    }, uid);
    etat = await ctx.storageState();
    await ctx.close();
  });

  for (const langue of LANGUES) {
    for (const chemin of ["/dashboard", "/history", "/settings"]) {
      test(`${langue} · ${chemin}`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: etat });
        const page = await ctx.newPage();
        await ouvrirEn(page, langue, chemin);
        // Les graphiques arrivent à part : on leur laisse le temps de se poser.
        await page.waitForTimeout(1200);

        const texte = await page.evaluate(() => document.body.innerText);
        expect({ chemin, langue, trous: texte.match(/\bundefined\b|\[object Object\]/g) ?? [] })
          .toEqual({ chemin, langue, trous: [] });

        const deborde = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect({ chemin, langue, deborde }).toEqual({ chemin, langue, deborde: false });

        expect(await page.evaluate(() => document.documentElement.lang)).toBe(langue);
        await ctx.close();
      });
    }
  }
});
