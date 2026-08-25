import {
  ajouter, charger, CLE, enregistrer, lireCode, MAX_ENTREES, noter, type Entree,
} from "./journalSynchro";

const entree = (quand: number): Entree => ({ quand, resultat: "rien" });
/** Des entrées qui ne se ressemblent pas : elles ne doivent pas se regrouper. */
const distincte = (quand: number): Entree => ({ quand, resultat: "erreur", code: 400 + quand });

/**
 * Un stockage local minimal.
 *
 * Les tests tournent dans Node, où `localStorage` n'existe pas. Charger jsdom
 * pour un objet à quatre méthodes coûterait plus cher que de l'écrire, et le
 * module ne se sert de rien d'autre.
 */
const memoire = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (c: string) => memoire.get(c) ?? null,
  setItem: (c: string, v: string) => { memoire.set(c, String(v)); },
  removeItem: (c: string) => { memoire.delete(c); },
  clear: () => { memoire.clear(); },
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() { return memoire.size; },
} as Storage;

describe("journal", () => {
  it("met la plus récente en tête et borne la longueur", () => {
    let j: Entree[] = [];
    for (let i = 0; i < MAX_ENTREES + 10; i += 1) j = ajouter(j, distincte(i));
    expect(j).toHaveLength(MAX_ENTREES);
    expect(j[0].quand).toBe(MAX_ENTREES + 9);
  });

  it("regroupe les répétitions au lieu d'empiler la même ligne", () => {
    // Sans clé Riot, la boucle rend le même refus toutes les deux minutes : le
    // journal devenait vingt lignes identiques, c'est-à-dire vingt fois rien.
    let j: Entree[] = [];
    for (let i = 0; i < 30; i += 1) j = ajouter(j, entree(i));
    expect(j).toHaveLength(1);
    expect(j[0].repetitions).toBe(30);
    // L'instant retenu est le dernier : c'est « depuis quand ça dure » qui
    // compte, pas la première fois.
    expect(j[0].quand).toBe(29);
  });

  it("ne regroupe que ce qui a la même cause", () => {
    let j = ajouter([], { quand: 1, resultat: "refus", code: 503, motif: "indisponible" });
    j = ajouter(j, { quand: 2, resultat: "refus", code: 503, motif: "indisponible" });
    j = ajouter(j, { quand: 3, resultat: "refus", code: 429, motif: "saturee" });
    expect(j).toHaveLength(2);
    expect(j[0].code).toBe(429);
    expect(j[0].repetitions).toBeUndefined();
    expect(j[1].repetitions).toBe(2);
  });

  it("ne regroupe qu'avec la ligne du dessus, pas avec une plus ancienne", () => {
    // Deux pannes séparées par une réussite sont deux événements : les fondre
    // effacerait le fait que ça avait remarché entre-temps.
    let j = ajouter([], { quand: 1, resultat: "refus", code: 503 });
    j = ajouter(j, { quand: 2, resultat: "partie", detail: "Ahri" });
    j = ajouter(j, { quand: 3, resultat: "refus", code: 503 });
    expect(j).toHaveLength(3);
  });
});

describe("lecture d'un code HTTP", () => {
  it("distingue les trois situations qui ne se corrigent pas pareil", () => {
    // Attendre, changer un réglage, ou ne rien faire : le code seul ne le dit
    // à personne qui n'écrit pas de logiciel.
    expect(lireCode(429).resultat).toBe("refus");
    expect(lireCode(400).resultat).toBe("erreur");
    expect(lireCode(404).resultat).toBe("rien");
  });

  it("dit que la clé du serveur est en cause, pas le compte", () => {
    for (const code of [401, 403]) {
      expect(lireCode(code).motif).toBe("cleRefusee");
    }
  });

  it("distingue « nous ne sommes pas prêts » de « Riot ne répond pas »", () => {
    /**
     * Sans clé de production, la route rend 503 et non 500. Le journal disait
     * « Riot ne répond pas », ce qui est faux — et c'est la situation du
     * lancement : on aurait imputé à Riot une case vide de notre côté,
     * pendant des jours.
     */
    expect(lireCode(503).motif).toBe("indisponible");
    expect(lireCode(500).motif).toBe("riotMuet");
    expect(lireCode(502).motif).toBe("riotMuet");
  });

  it("ne laisse aucun code sans motif", () => {
    for (const code of [400, 401, 403, 404, 418, 429, 500, 503]) {
      expect(typeof lireCode(code).motif).toBe("string");
      expect(lireCode(code).motif.length).toBeGreaterThan(3);
    }
  });
});

describe("stockage", () => {
  beforeEach(() => localStorage.clear());

  it("fait le tour complet", () => {
    enregistrer([entree(1), entree(2)]);
    expect(charger()).toHaveLength(2);
  });

  it("rend une liste vide plutôt que de lever sur du contenu abîmé", () => {
    // Un journal illisible ne doit pas empêcher la page de s'afficher.
    for (const brut of ["{ceci n'est pas du JSON", '"une chaîne"', "42", "null"]) {
      localStorage.setItem(CLE, brut);
      expect(charger()).toEqual([]);
    }
  });

  it("jette les entrées mal formées sans emporter les bonnes", () => {
    localStorage.setItem(CLE, JSON.stringify([
      entree(3), { quand: "hier" }, null, { resultat: "rien" }, entree(1),
    ]));
    expect(charger()).toHaveLength(2);
  });

  it("note une entrée avec son instant", () => {
    const j = noter({ resultat: "partie", detail: "1 partie" });
    expect(j[0].resultat).toBe("partie");
    expect(typeof j[0].quand).toBe("number");
    expect(charger()).toHaveLength(1);
  });
});
