/**
 * La mémoire des paliers et de la série, et les deux choses qu'elle oubliait.
 *
 * Elle porte maintenant le JOUR de la réponse : sans lui, un onglet laissé
 * ouvert pendant la nuit gardait la série de la veille — avec son état de
 * retard, c'est-à-dire l'information exacte qu'on vient regarder le matin.
 *
 * Et elle ne retient plus un échec : une coupure d'une seconde effaçait les
 * paliers et la série pour toute la durée de la page.
 */
import {
  chargerProgression, oublierProgression, rafraichirProgression,
} from "@/lib/chargerProgression";

const P = { badges: { prochain: 100 }, serie: { jours: 3 } };

const vraiFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = vraiFetch; oublierProgression(); });

function repond(corps: unknown) {
  return jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(corps) }));
}

describe("chargerProgression", () => {
  it("ne demande qu'une fois pour le même jour", async () => {
    const appels = repond(P);
    globalThis.fetch = appels as never;
    await Promise.all([chargerProgression("2026-09-02"), chargerProgression("2026-09-02")]);
    await chargerProgression("2026-09-02");
    expect(appels).toHaveBeenCalledTimes(1);
  });

  it("porte le jour demandé dans l'adresse", async () => {
    const appels = repond(P);
    globalThis.fetch = appels as never;
    await chargerProgression("2026-09-02");
    expect(appels).toHaveBeenCalledWith(expect.stringContaining("jour=2026-09-02"));
  });

  /**
   * Le cas de l'onglet resté ouvert toute la nuit. Sans ce contrôle, la
   * réponse de la veille servait indéfiniment.
   */
  it("redemande quand le jour a changé", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(P) }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true, json: () => Promise.resolve({ ...P, serie: { jours: 4 } }),
      }));
    globalThis.fetch = appels as never;

    await expect(chargerProgression("2026-09-02")).resolves.toEqual(P);
    await expect(chargerProgression("2026-09-03")).resolves.toEqual({ ...P, serie: { jours: 4 } });
    expect(appels).toHaveBeenCalledTimes(2);
  });

  it("retente après une coupure au lieu de figer un écran vide", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.reject(new Error("hors ligne")))
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(P) }));
    globalThis.fetch = appels as never;

    await expect(chargerProgression("2026-09-02")).resolves.toBeNull();
    await expect(chargerProgression("2026-09-02")).resolves.toEqual(P);
    expect(appels).toHaveBeenCalledTimes(2);
  });

  it("retente après une réponse en erreur", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }))
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(P) }));
    globalThis.fetch = appels as never;

    await expect(chargerProgression("2026-09-02")).resolves.toBeNull();
    await expect(chargerProgression("2026-09-02")).resolves.toEqual(P);
    expect(appels).toHaveBeenCalledTimes(2);
  });
});

describe("rafraichirProgression", () => {
  /** Après un paiement, la série et les paliers bougent : on redemande. */
  it("redemande même si la réponse du jour est déjà en mémoire", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(P) }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true, json: () => Promise.resolve({ ...P, badges: { prochain: 200 } }),
      }));
    globalThis.fetch = appels as never;

    await chargerProgression("2026-09-02");
    await rafraichirProgression("2026-09-02");
    await expect(chargerProgression("2026-09-02"))
      .resolves.toEqual({ ...P, badges: { prochain: 200 } });
    expect(appels).toHaveBeenCalledTimes(2);
  });
});
