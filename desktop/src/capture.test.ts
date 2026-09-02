/**
 * Deux choses de la capture d'écran qui peuvent échouer en silence.
 *
 * - **L'écran noir.** Le plein écran exclusif contourne le compositeur et la
 *   capture revient noire. Se tromper coûte des deux côtés : dire « noir » sur
 *   un écran plein prive le joueur de sa capture, et écrire un JPEG noir lui
 *   fait croire que ça a marché — la lecture des chiffres ne trouvera rien, et
 *   le message parlera d'une partie illisible plutôt que d'un mode d'affichage.
 * - **Le raccourci.** Un raccourci global échoue quand une autre application le
 *   détient déjà, ce qui est le cas courant avec Discord, GeForce ou Steam. Si
 *   la chaîne de repli casse, il n'y a plus AUCUN raccourci de capture, et rien
 *   ne le dit : on appuie, il ne se passe rien.
 *
 * `electron` est doublé ; rien ici ne demande d'écran.
 */
const raccourcis = {
  pris: new Set<string>(), poses: [] as string[], rendus: [] as string[],
};

jest.mock("electron", () => ({
  desktopCapturer: { getSources: jest.fn() },
  screen: { getPrimaryDisplay: jest.fn() },
  globalShortcut: {
    register: (combinaison: string, _f: () => void) => {
      if (raccourcis.pris.has(combinaison)) return false;
      raccourcis.poses.push(combinaison);
      return true;
    },
    unregister: (combinaison: string) => { raccourcis.rendus.push(combinaison); },
  },
  app: { getPath: () => "/tmp" },
}), { virtual: true });

import { estNoir, initCapture, lireRaccourciCapture } from "./capture.js";

/** Une image de test : fond noir, plus les rectangles lumineux demandés. */
function ecran(
  largeur: number, hauteur: number,
  blocs: { x: number; y: number; w: number; h: number }[] = [],
) {
  const bitmap = Buffer.alloc(largeur * hauteur * 4);
  for (const b of blocs) {
    for (let j = b.y; j < b.y + b.h; j++) {
      for (let i = b.x; i < b.x + b.w; i++) {
        const p = (j * largeur + i) * 4;
        bitmap[p] = 255; bitmap[p + 1] = 255; bitmap[p + 2] = 255;
      }
    }
  }
  return { toBitmap: () => bitmap };
}

describe("estNoir", () => {
  it("reconnaît un écran entièrement noir", () => {
    expect(estNoir(ecran(1920, 1080))).toBe(true);
  });

  it("ne prend pas un écran de jeu pour un écran noir", () => {
    // Le tableau de fin d'Apex occupe une bonne part de l'écran.
    expect(estNoir(ecran(1920, 1080, [{ x: 300, y: 200, w: 1200, h: 600 }]))).toBe(false);
  });

  /**
   * Le seuil réel, mesuré. Le commentaire du module promettait qu'« un petit
   * élément lumineux ne passe pas pour un écran vide » : c'est faux en dessous
   * d'environ cent pixels de large, et ce test pin la vérité plutôt que
   * l'intention. Ce n'est pas un défaut — un écran où seule une pastille brille
   * n'a pas de chiffres à lire, et le refuser est le bon résultat.
   */
  it("voit une zone de 100×20, pas une de 50×10", () => {
    expect(estNoir(ecran(1920, 1080, [{ x: 10, y: 10, w: 100, h: 20 }]))).toBe(false);
    expect(estNoir(ecran(1920, 1080, [{ x: 10, y: 10, w: 50, h: 10 }]))).toBe(true);
  });

  /** Le seuil de 12 laisse passer le bruit d'un noir non parfait. */
  it("tolère un noir imparfait", () => {
    const presqueNoir = ecran(1920, 1080);
    const b = presqueNoir.toBitmap();
    for (let i = 0; i < b.length; i++) b[i] = 10;
    expect(estNoir(presqueNoir)).toBe(true);
    for (let i = 0; i < b.length; i++) b[i] = 40;
    expect(estNoir(presqueNoir)).toBe(false);
  });

  // Sans ce contrôle, une image vide rendrait « noir » sans avoir rien lu —
  // et le module conclurait « plein écran exclusif » sur une capture ratée.
  it("ne conclut pas au noir sur une image vide", () => {
    expect(estNoir({ toBitmap: () => Buffer.alloc(0) })).toBe(false);
  });
});

describe("le raccourci de capture", () => {
  beforeEach(() => {
    raccourcis.pris.clear();
    raccourcis.poses.length = 0;
    raccourcis.rendus.length = 0;
  });

  it("prend le premier candidat quand il est libre", () => {
    expect(initCapture(() => {})).toBe("Control+Shift+S");
    expect(lireRaccourciCapture()).toBe("Control+Shift+S");
  });

  /** Le cas courant : Discord tient déjà Ctrl+Maj+S. */
  it("passe au suivant quand une autre application le détient", () => {
    raccourcis.pris.add("Control+Shift+S");
    expect(initCapture(() => {})).toBe("Alt+Shift+S");
  });

  it("descend toute la liste plutôt que de renoncer au premier refus", () => {
    for (const c of ["Control+Shift+S", "Alt+Shift+S", "Control+Alt+S"]) raccourcis.pris.add(c);
    expect(initCapture(() => {})).toBe("Alt+S");
  });

  /**
   * Tout est pris : il n'y a pas de raccourci, et `initCapture` doit le DIRE.
   * L'appelant montre alors autre chose — sans quoi on appuie sur une touche
   * qui n'est à personne et rien ne se passe.
   */
  it("rend une valeur fausse quand aucun candidat n'est libre", () => {
    for (const c of ["Control+Shift+S", "Alt+Shift+S", "Control+Alt+S", "Alt+S"]) {
      raccourcis.pris.add(c);
    }
    expect(initCapture(() => {})).toBeFalsy();
  });

  /**
   * Et une seconde pose ne garde rien de la première.
   *
   * C'est ce qui a mis le défaut au jour : `raccourciActif` survivait à
   * l'appel, donc une seconde pose où tout est pris rendait quand même le
   * raccourci d'avant — et `lireRaccourciCapture` l'annonçait à l'écran alors
   * qu'il n'appelait plus personne. Personne ne peut l'atteindre aujourd'hui,
   * `main.js` n'appelant qu'une fois au démarrage.
   */
  it("rend le raccourci de CET appel, pas celui du précédent", () => {
    expect(initCapture(() => {})).toBe("Control+Shift+S");
    for (const c of ["Control+Shift+S", "Alt+Shift+S", "Control+Alt+S", "Alt+S"]) {
      raccourcis.pris.add(c);
    }
    expect(initCapture(() => {})).toBeFalsy();
    expect(lireRaccourciCapture()).toBeFalsy();
    // Et l'ancien est rendu au système : le garder enregistré laisserait son
    // rappel vivant sur une touche qu'on n'annonce plus.
    expect(raccourcis.rendus).toContain("Control+Shift+S");
  });
});
