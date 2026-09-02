import { abonnerFile, echecFile, enfiler, lireFile, viderFile } from "./fileHorsLigne";

/**
 * La file des séances faites sans réseau.
 *
 * Ce qui est éprouvé ici, c'est ce qui décide qu'une entrée part, reste ou
 * disparaît. C'est la partie qui peut faire perdre un effort réellement fourni
 * — le pire défaut possible pour cette application — ou le compter deux fois.
 */

const CLE = "low_file_paiements";

function stockageFactice() {
  let donnees: Record<string, string> = {};
  return {
    getItem: (k: string) => donnees[k] ?? null,
    setItem: (k: string, v: string) => { donnees[k] = v; },
    removeItem: (k: string) => { delete donnees[k]; },
    clear: () => { donnees = {}; },
  };
}

const reponse = (status: number) => ({ ok: status >= 200 && status < 300, status });

/**
 * Le stockage se pose sur `window`, pas sur `globalThis`.
 *
 * Le module passe par `src/lib/stockage.ts`, qui lit `window.localStorage` :
 * c'est l'accesseur qui lève quand le navigateur bloque les données de site,
 * et c'est donc lui qu'il faut traverser. Une doublure posée à côté ne serait
 * jamais lue, et la suite éprouverait un stockage vide en croyant éprouver le
 * sien.
 */
function poserStockage(valeur: unknown) {
  globalThis.window = {
    dispatchEvent: jest.fn(),
    localStorage: valeur,
    // `dispatchEvent` sert à rafraîchir la pastille ; il n'est pas éprouvé ici.
  } as unknown as Window & typeof globalThis;
}

beforeEach(() => {
  poserStockage(stockageFactice());
  globalThis.fetch = jest.fn();
});

describe("mettre de côté", () => {
  test("garde ce qu'on lui donne, avec un jeton et une date", () => {
    enfiler({ secondes: 120, jour: "2026-08-23" });
    const [entree] = lireFile();
    expect(entree.secondes).toBe(120);
    expect(entree.jour).toBe("2026-08-23");
    expect(typeof entree.jeton).toBe("string");
    expect(entree.jeton.length).toBeGreaterThan(8);
    expect(entree.quand).toBeGreaterThan(0);
  });

  test("deux séances ne partagent jamais un jeton", () => {
    // Le jeton est ce qui empêche de payer deux fois : deux entrées qui le
    // partageraient feraient perdre la seconde, silencieusement.
    const jetons = new Set<string>();
    for (let i = 0; i < 200; i++) jetons.add(enfiler({ secondes: 30, jour: "2026-08-23" }));
    expect(jetons.size).toBe(200);
  });

  test("prévient qui l'écoute", () => {
    const vu = jest.fn();
    const arreter = abonnerFile(vu);
    enfiler({ tout: true, jour: "2026-08-23" });
    expect(vu).toHaveBeenCalled();
    arreter();
  });

  test("un stockage qui refuse d'écrire ne fait pas tomber l'application", () => {
    poserStockage({ getItem: () => null, setItem: () => { throw new Error("refusé"); } });
    expect(() => enfiler({ secondes: 60, jour: "2026-08-23" })).not.toThrow();
  });

  test("un contenu illisible se lit comme une file vide", () => {
    window.localStorage.setItem(CLE, "{ceci n'est pas du JSON");
    expect(lireFile()).toEqual([]);
  });
});

describe("renvoyer", () => {
  test("envoie chaque séance avec son jeton et la retire une fois passée", async () => {
    enfiler({ secondes: 90, jour: "2026-08-23" });
    enfiler({ tout: true, jour: "2026-08-24" });
    (globalThis.fetch as jest.Mock).mockResolvedValue(reponse(200));

    expect(await viderFile()).toBe(2);
    expect(lireFile()).toEqual([]);

    const corps = (globalThis.fetch as jest.Mock).mock.calls.map((c) => JSON.parse(c[1].body));
    expect(corps[0]).toMatchObject({ secondes: 90, jour: "2026-08-23" });
    expect(corps[1]).toMatchObject({ tout: true, jour: "2026-08-24" });
    for (const c of corps) expect(typeof c.jeton).toBe("string");
  });

  test("envoie une entrée à la fois, jamais deux ensemble", async () => {
    // Le serveur calcule chaque paiement sur la dette du moment : deux envois
    // simultanés liraient la même valeur et l'un des deux serait perdu.
    enfiler({ secondes: 10, jour: "2026-08-23" });
    enfiler({ secondes: 20, jour: "2026-08-23" });
    let enVol = 0;
    (globalThis.fetch as jest.Mock).mockImplementation(async () => {
      enVol++;
      expect(enVol).toBe(1);
      await Promise.resolve();
      enVol--;
      return reponse(200);
    });
    await viderFile();
  });

  test("garde tout quand le réseau est encore coupé", async () => {
    enfiler({ secondes: 60, jour: "2026-08-23" });
    enfiler({ secondes: 30, jour: "2026-08-23" });
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("hors réseau"));

    expect(await viderFile()).toBe(0);
    expect(lireFile()).toHaveLength(2);
  });

  test("s'arrête au premier échec réseau plutôt que de brûler la file", async () => {
    enfiler({ secondes: 60, jour: "2026-08-23" });
    enfiler({ secondes: 30, jour: "2026-08-23" });
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("hors réseau"));
    await viderFile();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test("garde la séance quand la session a expiré", async () => {
    // 401 : la jeter serait perdre l'effort pour de bon. Elle repartira une
    // fois reconnecté.
    enfiler({ secondes: 60, jour: "2026-08-23" });
    (globalThis.fetch as jest.Mock).mockResolvedValue(reponse(401));
    expect(await viderFile()).toBe(0);
    expect(lireFile()).toHaveLength(1);
  });

  test("jette une séance que le serveur refuse pour de bon", async () => {
    // 400 : le serveur n'en voudra jamais. La garder ferait bloquer toute la
    // file derrière elle, indéfiniment.
    enfiler({ secondes: 60, jour: "2026-08-23" });
    enfiler({ secondes: 30, jour: "2026-08-23" });
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(reponse(400))
      .mockResolvedValueOnce(reponse(200));
    expect(await viderFile()).toBe(1);
    expect(lireFile()).toEqual([]);
  });

  test("garde la séance quand le serveur est en panne", async () => {
    enfiler({ secondes: 60, jour: "2026-08-23" });
    (globalThis.fetch as jest.Mock).mockResolvedValue(reponse(500));
    expect(await viderFile()).toBe(0);
    expect(lireFile()).toHaveLength(1);
  });

  test("ne prévient la pastille que si quelque chose est passé", async () => {
    enfiler({ secondes: 60, jour: "2026-08-23" });
    (globalThis.fetch as jest.Mock).mockResolvedValue(reponse(500));
    await viderFile();
    expect(globalThis.window.dispatchEvent).not.toHaveBeenCalled();

    (globalThis.fetch as jest.Mock).mockResolvedValue(reponse(200));
    await viderFile();
    expect(globalThis.window.dispatchEvent).toHaveBeenCalled();
  });
});

/**
 * Pourquoi la file n'avance pas.
 *
 * Six séances ont attendu des heures sur une machine parfaitement en ligne,
 * et rien à l'écran ne disait pourquoi. Une file qui grossit en silence est
 * la pire des deux : on la voit, on est connecté, et il n'y a aucune suite à
 * donner.
 */
describe("la raison du blocage", () => {
  beforeEach(() => {
    // La préparation globale pose déjà le stockage sur `window` ; on n'ajoute
    // qu'une entrée à envoyer.
    enfiler({ jour: "2026-09-02", secondes: 60 });
  });

  it("dit « session » sur un 401", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as never;
    await viderFile();
    expect(echecFile()).toEqual({ motif: "session" });
  });

  it("dit « serveur » sur un 500, avec le code", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as never;
    await viderFile();
    expect(echecFile()).toEqual({ motif: "serveur", code: 503 });
  });

  it("dit « réseau » quand l'envoi ne part pas", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("hors ligne")) as never;
    await viderFile();
    expect(echecFile()).toEqual({ motif: "reseau" });
  });

  it("n'a plus rien à signaler quand tout est passé", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as never;
    await viderFile();
    expect(echecFile()).not.toBeNull();
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as never;
    await viderFile();
    expect(echecFile()).toBeNull();
  });

  /**
   * L'abonnement est ce qui fait remonter la raison à l'écran. Sans lui, elle
   * serait notée dans un module que personne ne relit.
   */
  it("prévient les abonnés même quand rien n'est passé", async () => {
    const vu = jest.fn();
    const desabonner = abonnerFile(vu);
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as never;
    await viderFile();
    expect(vu).toHaveBeenCalled();
    desabonner();
  });
});
