// `export {}` fait de ce fichier un module : sans lui, ses `const` de tête
// vivent dans la portée globale et se heurtent à celles des autres tests.
export {};

// Le placement de la pastille en jeu. C'est la seule partie du module qui
// puisse la rendre invisible, et elle n'avait aucun test.

let taille = { width: 1920, height: 1080 };
jest.mock("electron", () => ({
  BrowserWindow: class {},
  globalShortcut: { register: () => false, unregisterAll: () => {} },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: taille }) },
}), { virtual: true });

const { _placement } = require("./overlay");
const { positionDuCoin, dansLEcran, LARGEUR, HAUTEUR, MARGE } = _placement;

describe("le coin demandé", () => {
  beforeEach(() => { taille = { width: 1920, height: 1080 }; });

  it("pose la pastille dans chacun des quatre coins", () => {
    expect(positionDuCoin("haut-gauche")).toEqual({ x: MARGE, y: MARGE });
    expect(positionDuCoin("haut-droite")).toEqual({ x: 1920 - LARGEUR - MARGE, y: MARGE });
    expect(positionDuCoin("bas-gauche")).toEqual({ x: MARGE, y: 1080 - HAUTEUR - MARGE });
    expect(positionDuCoin("bas-droite"))
      .toEqual({ x: 1920 - LARGEUR - MARGE, y: 1080 - HAUTEUR - MARGE });
  });

  it("retombe en haut à droite quand le coin est inconnu", () => {
    // C'est le coin par défaut du produit : un réglage effacé ou une valeur
    // d'une version antérieure ne doit pas poser la pastille en (0, 0), par
    // dessus l'interface du jeu.
    expect(positionDuCoin(null)).toEqual({ x: 1920 - LARGEUR - MARGE, y: MARGE });
    expect(positionDuCoin(undefined)).toEqual({ x: 1920 - LARGEUR - MARGE, y: MARGE });
  });

  it("tient dans un petit écran sans sortir par la gauche", () => {
    // Un écran de 1024 laisse encore la place ; l'important est que x reste
    // positif, sinon la pastille commence hors de l'écran.
    taille = { width: 1024, height: 768 };
    const p = positionDuCoin("bas-droite");
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });
});

describe("le retour dans l'écran", () => {
  beforeEach(() => { taille = { width: 1920, height: 1080 }; });

  it("laisse une position déjà valable où elle est", () => {
    expect(dansLEcran({ x: 400, y: 300 })).toEqual({ x: 400, y: 300 });
  });

  it("ramène une position sortie par la droite ou par le bas", () => {
    // Une résolution qui change, un second écran débranché, et la pastille se
    // retrouve posée hors de tout affichage.
    expect(dansLEcran({ x: 5000, y: 5000 }))
      .toEqual({ x: 1920 - LARGEUR, y: 1080 - HAUTEUR });
  });

  it("ramène une position négative à zéro", () => {
    expect(dansLEcran({ x: -300, y: -80 })).toEqual({ x: 0, y: 0 });
  });

  it("arrondit : une position fractionnaire vient d'un écran à échelle", () => {
    expect(dansLEcran({ x: 100.6, y: 40.2 })).toEqual({ x: 101, y: 40 });
  });

  it("ne rend jamais une position négative, même sur un écran plus petit que la pastille", () => {
    // Cas extrême mais atteignable : une zone de travail réduite par une barre
    // des tâches gigantesque, ou un écran secondaire minuscule.
    taille = { width: 200, height: 150 };
    const p = dansLEcran({ x: 50, y: 50 });
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });
});
