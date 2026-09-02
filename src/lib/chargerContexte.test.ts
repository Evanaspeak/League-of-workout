/**
 * Ce que la mémoire de module retient, et ce qu'elle ne doit pas retenir.
 *
 * Elle existe pour qu'un seul appel de `/api/contexte` serve à tous les
 * composants d'un écran : sans elle, le fournisseur de contexte et la mémoire
 * du compte demandaient deux fois la même réponse. C'est un gain mesuré, et
 * c'est aussi la seule chose qui peut mal tourner ici — une mémoire qui garde
 * la mauvaise valeur la garde pour toute la page.
 *
 * Le cas qui compte est l'ÉCHEC. Une coupure d'une seconde au chargement rend
 * `null` à tout le monde ; si ce `null` se mémorise, l'écran ment jusqu'au
 * prochain rafraîchissement, qui peut ne jamais venir : compteur de dette
 * vide, lien d'administration absent, consentement redemandé.
 */
import { chargerContexte, oublierContexte, rafraichirContexte } from "@/lib/chargerContexte";

const CONTEXTE = { user: { id: "u1" }, dette: null, consentement: null };

const vraiFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = vraiFetch; oublierContexte(); });

function repond(corps: unknown, ok = true) {
  return jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(corps) }));
}

describe("chargerContexte", () => {
  it("ne demande qu'une fois pour plusieurs appelants", async () => {
    const appels = repond(CONTEXTE);
    globalThis.fetch = appels as never;
    const [a, b] = await Promise.all([chargerContexte(), chargerContexte()]);
    expect(a).toEqual(CONTEXTE);
    expect(b).toEqual(CONTEXTE);
    expect(appels).toHaveBeenCalledTimes(1);
  });

  it("garde la réponse pour les appels suivants", async () => {
    const appels = repond(CONTEXTE);
    globalThis.fetch = appels as never;
    await chargerContexte();
    await chargerContexte();
    expect(appels).toHaveBeenCalledTimes(1);
  });

  /** Le cœur : un échec ne se mémorise pas, le montage suivant retente. */
  it("retente après une coupure au lieu de figer un contexte vide", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.reject(new Error("hors ligne")))
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(CONTEXTE) }));
    globalThis.fetch = appels as never;

    await expect(chargerContexte()).resolves.toBeNull();
    await expect(chargerContexte()).resolves.toEqual(CONTEXTE);
    expect(appels).toHaveBeenCalledTimes(2);
  });

  /** Une session expirée passe par le même chemin : 401, donc `null`, donc retente. */
  it("retente après une réponse en erreur", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }))
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(CONTEXTE) }));
    globalThis.fetch = appels as never;

    await expect(chargerContexte()).resolves.toBeNull();
    await expect(chargerContexte()).resolves.toEqual(CONTEXTE);
    expect(appels).toHaveBeenCalledTimes(2);
  });

  /** Une réponse qui n'est pas un objet ne devient pas un contexte. */
  it("refuse une réponse d'une autre forme", async () => {
    globalThis.fetch = repond("bonjour") as never;
    await expect(chargerContexte()).resolves.toBeNull();
  });
});

describe("rafraichirContexte", () => {
  it("redemande vraiment et remplace ce que tout le monde lira", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(CONTEXTE) }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true, json: () => Promise.resolve({ ...CONTEXTE, dette: { points: 12 } }),
      }));
    globalThis.fetch = appels as never;

    await chargerContexte();
    await rafraichirContexte();
    await expect(chargerContexte()).resolves.toEqual({ ...CONTEXTE, dette: { points: 12 } });
    expect(appels).toHaveBeenCalledTimes(2);
  });

  /**
   * Un rafraîchissement raté ne doit pas effacer non plus : il tombe dans la
   * même règle, sinon un paiement fait hors ligne viderait l'écran.
   */
  it("ne fige pas un contexte vide quand le rafraîchissement échoue", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(CONTEXTE) }))
      .mockImplementationOnce(() => Promise.reject(new Error("hors ligne")))
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(CONTEXTE) }));
    globalThis.fetch = appels as never;

    await chargerContexte();
    await expect(rafraichirContexte()).resolves.toBeNull();
    await expect(chargerContexte()).resolves.toEqual(CONTEXTE);
    expect(appels).toHaveBeenCalledTimes(3);
  });
});
