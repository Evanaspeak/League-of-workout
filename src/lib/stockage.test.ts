import {
  ecrire, ecrireJson, ecrireSession, effacer, effacerSession,
  lire, lireJson, lireSession,
} from "./stockage";

/**
 * Ce que le module garantit : il ne lève jamais, et un stockage indisponible
 * se comporte comme un stockage vide.
 *
 * Le cas qui a motivé le module n'est pas la navigation privée — elle oublie,
 * elle ne lève pas. C'est le navigateur réglé pour bloquer les données de
 * site : l'ACCESSEUR `window.localStorage` lève alors une `SecurityError`,
 * avant même qu'on ait demandé une clé.
 */

/**
 * Un `window` fabriqué, plutôt qu'un environnement jsdom.
 *
 * Le projet fait tourner ses tests en environnement `node` : c'est ce qui
 * rend la suite rapide et sans dépendance de navigateur. Le module ne demande
 * qu'une chose à `window`, ses deux accesseurs de stockage — on les pose donc
 * à la main, ce qui a l'avantage de permettre à l'accesseur de LEVER, qui est
 * précisément le cas qu'on éprouve et que jsdom ne sait pas simuler.
 */
const global = globalThis as unknown as { window?: Record<string, unknown> };

function poser(nom: "localStorage" | "sessionStorage", valeur: unknown) {
  if (!global.window) global.window = {};
  Object.defineProperty(global.window, nom, {
    configurable: true,
    get: () => {
      if (typeof valeur === "function") return (valeur as () => unknown)();
      return valeur;
    },
  });
}

/** Le rendu serveur, où `window` n'existe pas du tout. */
function sansFenetre() {
  delete global.window;
}

const vrai = () => {
  const donnees = new Map<string, string>();
  return {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => { donnees.set(k, v); },
    removeItem: (k: string) => { donnees.delete(k); },
  } as unknown as Storage;
};

afterEach(() => {
  poser("localStorage", vrai());
  poser("sessionStorage", vrai());
});

beforeEach(() => {
  poser("localStorage", vrai());
  poser("sessionStorage", vrai());
});

describe("stockage disponible", () => {
  it("écrit et relit", () => {
    expect(ecrire("a", "1")).toBe(true);
    expect(lire("a")).toBe("1");
    effacer("a");
    expect(lire("a")).toBeNull();
  });

  it("fait de même en session, sans se mélanger avec le local", () => {
    ecrire("k", "local");
    ecrireSession("k", "session");
    expect(lire("k")).toBe("local");
    expect(lireSession("k")).toBe("session");
    effacerSession("k");
    expect(lireSession("k")).toBeNull();
    expect(lire("k")).toBe("local");
  });

  it("range et relit du JSON", () => {
    ecrireJson("o", { a: 1 });
    expect(lireJson("o", { a: 0 })).toEqual({ a: 1 });
  });

  it("rend le défaut plutôt que de tomber sur un JSON abîmé", () => {
    // Un format qui a changé entre deux versions ne doit pas casser un écran.
    ecrire("o", "{pas du json");
    expect(lireJson("o", "repli")).toBe("repli");
  });

  it("ne lève pas sur une structure circulaire", () => {
    const boucle: Record<string, unknown> = {};
    boucle.soi = boucle;
    expect(ecrireJson("c", boucle)).toBe(false);
  });
});

describe("stockage bloqué par le navigateur", () => {
  beforeEach(() => {
    // C'est l'ACCESSEUR qui lève, pas la méthode : c'est tout le propos.
    poser("localStorage", () => { throw new DOMException("bloqué", "SecurityError"); });
    poser("sessionStorage", () => { throw new DOMException("bloqué", "SecurityError"); });
  });

  it("lit comme si la valeur manquait", () => {
    expect(lire("a")).toBeNull();
    expect(lireSession("a")).toBeNull();
    expect(lireJson("a", "defaut")).toBe("defaut");
  });

  it("dit que l'écriture n'a pas eu lieu, sans lever", () => {
    expect(ecrire("a", "1")).toBe(false);
    expect(ecrireSession("a", "1")).toBe(false);
    expect(ecrireJson("a", { x: 1 })).toBe(false);
  });

  it("efface sans rien casser", () => {
    expect(() => { effacer("a"); effacerSession("a"); }).not.toThrow();
  });
});

describe("au rendu serveur", () => {
  // Ce que ce test NE prouve PAS : que le garde `typeof window` serve. Le
  // `catch` du module rattraperait la `ReferenceError`, donc le retirer laisse
  // ce test au vert — sabotage fait. Le garde est là pour ne pas faire du
  // chemin normal du serveur une exception levée à chaque rendu, pas pour la
  // correction du résultat.
  it("se comporte comme un stockage vide, sans chercher de fenêtre", () => {
    sansFenetre();
    expect(lire("a")).toBeNull();
    expect(lireSession("a")).toBeNull();
    expect(ecrire("a", "1")).toBe(false);
    expect(() => effacer("a")).not.toThrow();
  });
});

describe("stockage plein", () => {
  it("rend faux quand le quota est atteint", () => {
    poser("localStorage", {
      getItem: () => null,
      setItem: () => { throw new DOMException("plein", "QuotaExceededError"); },
      removeItem: () => {},
    } as unknown as Storage);
    expect(ecrire("a", "1")).toBe(false);
  });
});
