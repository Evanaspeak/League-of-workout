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
import { chargerContexte, oublierContexte, rafraichirContexte, SESSION_MORTE } from "@/lib/chargerContexte";

const CONTEXTE = { user: { id: "u1" }, dette: null, consentement: null };

const vraiFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = vraiFetch; oublierContexte(); });

function repond(corps: unknown, ok = true, status = ok ? 200 : 500) {
  return jest.fn(() => Promise.resolve({ ok, status, json: () => Promise.resolve(corps) }));
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

/**
 * Une session morte se dit, elle ne se tait pas.
 *
 * Les quatre écrans connectés rendus au serveur redirigent d'eux-mêmes vers la
 * connexion : ils lisent le compte en base. `/settings` est cliente de bout en
 * bout — elle restait donc affichée, chacun de ses panneaux annonçant son
 * échec avec « Rien n'est perdu : recharge la page », alors que recharger ne
 * répare rien. Mesuré avec un jeton dont le compte n'existe plus : les quatre
 * autres écrans partent sur `/login`, celui-là reste.
 *
 * Le 401 est le seul signal franc : sur une page connectée, le middleware a
 * déjà exigé une session pour servir la page, donc le jeton est lisible. Si la
 * route refuse quand même, c'est que le compte derrière n'existe plus.
 */
describe("la session morte", () => {
  const vraiWindow = (globalThis as { window?: unknown }).window;
  let emis: string[];
  beforeEach(() => {
    emis = [];
    (globalThis as { window?: unknown }).window = {
      dispatchEvent: (e: Event) => { emis.push(e.type); return true; },
    };
  });
  afterEach(() => { (globalThis as { window?: unknown }).window = vraiWindow; });

  it("se signale sur un 401", async () => {
    globalThis.fetch = repond({ error: "Non authentifié" }, false, 401) as never;
    expect(await chargerContexte()).toBeNull();
    expect(emis).toEqual([SESSION_MORTE]);
  });

  it("ne se signale PAS sur un 500", async () => {
    // Un serveur qui tousse n'est pas une session morte : déconnecter
    // quelqu'un pour une panne d'un instant lui ferait retaper son code pour
    // rien, et ce serait pire que l'écran vide qu'on corrige.
    globalThis.fetch = repond({ error: "boum" }, false, 500) as never;
    expect(await chargerContexte()).toBeNull();
    expect(emis).toEqual([]);
  });

  it("ne se signale PAS hors ligne", async () => {
    // Une coupure ne rend aucun statut : la promesse est rejetée, et c'est le
    // cas que la mémoire de module traite déjà en retentant.
    globalThis.fetch = jest.fn(() => Promise.reject(new Error("hors ligne"))) as never;
    expect(await chargerContexte()).toBeNull();
    expect(emis).toEqual([]);
  });

  it("ne se signale PAS quand tout va bien", async () => {
    globalThis.fetch = repond(CONTEXTE) as never;
    expect(await chargerContexte()).toEqual(CONTEXTE);
    expect(emis).toEqual([]);
  });
});
