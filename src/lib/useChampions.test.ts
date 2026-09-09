/**
 * La liste EN VIGUEUR : celle de la base si l'administration l'a modifiée,
 * celle du code sinon.
 *
 * Ce qui est éprouvé ici est la MÉMOIRE, et rien d'autre : l'échec ne se
 * mémorise pas — une coupure au premier montage figeait la liste codée en dur
 * pour toute la durée de la page, et cette liste sert à VALIDER, donc un
 * champion ajouté par l'administration devenait « non reconnu ».
 *
 * Le tri et la résolution des noms sont partis avec eux dans
 * `src/lib/champions.ts` : ils sont purs, et une route en a besoin.
 */
import { CHAMPIONS } from "@/lib/champions";
import { chargerChampions, invaliderChampions } from "@/lib/useChampions";

describe("chargement de la liste", () => {
  const vraiFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = vraiFetch; invaliderChampions(); });

  it("retombe sur la liste codée en dur quand l'appel échoue", async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error("hors ligne"))) as never;
    await expect(chargerChampions()).resolves.toEqual(CHAMPIONS);
  });

  /**
   * Le cœur : l'échec ne se mémorise pas. Le premier appel échoue, le second
   * doit REPARTIR au réseau — sans quoi la liste codée en dur tient jusqu'au
   * prochain rechargement de page.
   */
  it("retente après un échec au lieu de figer la liste", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.reject(new Error("hors ligne")))
      .mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(["Ahri", "Zoé la Nouvelle"]),
      }));
    globalThis.fetch = appels as never;

    await expect(chargerChampions()).resolves.toEqual(CHAMPIONS);
    await expect(chargerChampions()).resolves.toEqual(["Ahri", "Zoé la Nouvelle"]);
    expect(appels).toHaveBeenCalledTimes(2);
  });

  /** Une réussite, elle, se mémorise : un seul appel pour toute la page. */
  it("ne demande la liste qu'une fois quand l'appel réussit", async () => {
    const appels = jest.fn(() => Promise.resolve({
      json: () => Promise.resolve(["Ahri", "Zed"]),
    }));
    globalThis.fetch = appels as never;

    await chargerChampions();
    await chargerChampions();
    expect(appels).toHaveBeenCalledTimes(1);
  });

  /** Une réponse vide ou d'une autre forme ne remplace pas la liste. */
  it("ignore une réponse qui n'est pas une liste de champions", async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({
      json: () => Promise.resolve({ error: "Non authentifié" }),
    })) as never;
    await expect(chargerChampions()).resolves.toEqual(CHAMPIONS);
  });
});
