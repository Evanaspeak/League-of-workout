// `export {}` fait de ce fichier un module : sans lui, ses `const` de tête
// vivent dans la portée globale et se heurtent à celles des autres tests.
export {};

/**
 * Ce que la pastille fait quand personne ne regarde.
 *
 * `placement.test.ts` couvre l'arithmétique du coin — la seule chose qui puisse
 * la rendre INVISIBLE. Restent les quatre règles dont l'erreur ne se voit pas
 * davantage, parce qu'elles se jouent pendant qu'on joue :
 *
 *   - le temps de soirée, qui se compte de deux façons selon que le jeu se
 *     raconte ou non ;
 *   - la surveillance, qui retire une pastille restée seule à l'écran ;
 *   - le message de capture, qui la montre SANS la vouloir ;
 *   - la chaîne de repli des raccourcis, sans laquelle il n'y en a aucun.
 *
 * Le module ne s'éprouve qu'avec une doublure d'Electron : `jest.mock` la pose
 * en virtuel, puisque le paquet n'est pas installé du côté du site.
 */

let mockTaille = { width: 1920, height: 1080 };
/** Combinaisons qu'une autre application détient déjà. */
const mockPris = new Set<string>();
/** Toutes les fenêtres créées depuis le début du cas. */
const mockFenetres: MockFenetre[] = [];

class MockFenetre {
  detruite = false;
  visible = false;
  bounds: { x: number; y: number; width: number; height: number };
  envois: Array<[string, unknown]> = [];
  ecouteurs: Record<string, (...a: unknown[]) => void> = {};
  contenuProtege = false;
  ignoreSouris: boolean | null = null;
  focusable: boolean;
  /** Combien de fois on a demandé à la montrer : une alternance se compte. */
  montrees = 0;

  webContents = {
    send: (canal: string, charge: unknown) => { this.envois.push([canal, charge]); },
    on: (evt: string, cb: (...a: unknown[]) => void) => { this.ecouteurs[evt] = cb; },
  };

  constructor(opts: { x: number; y: number; width: number; height: number; focusable: boolean }) {
    this.bounds = { x: opts.x, y: opts.y, width: opts.width, height: opts.height };
    this.focusable = opts.focusable;
    mockFenetres.push(this);
  }

  setAlwaysOnTop() {}
  setVisibleOnAllWorkspaces() {}
  setIgnoreMouseEvents(v: boolean) { this.ignoreSouris = v; }
  setContentProtection(v: boolean) { this.contenuProtege = v; }
  setFocusable(v: boolean) { this.focusable = v; }
  setBounds(b: Partial<MockFenetre["bounds"]>) { this.bounds = { ...this.bounds, ...b }; }
  getBounds() { return this.bounds; }
  loadFile() {}
  showInactive() { this.visible = true; this.montrees += 1; }
  hide() { this.visible = false; }
  isVisible() { return this.visible; }
  isDestroyed() { return this.detruite; }
  destroy() { this.detruite = true; }
  on(evt: string, cb: (...a: unknown[]) => void) { this.ecouteurs[evt] = cb; }
}

jest.mock("electron", () => ({
  BrowserWindow: MockFenetre,
  screen: { getPrimaryDisplay: () => ({ workAreaSize: mockTaille }) },
  globalShortcut: {
    // `register` rend faux quand le système refuse : c'est le seul signal.
    register: (combinaison: string) => !mockPris.has(combinaison),
    unregisterAll: () => {},
  },
}), { virtual: true });

/* eslint-disable @typescript-eslint/no-explicit-any */
type Overlay = typeof import("./overlay");

let overlay: Overlay;
let arreter: () => void;

/** Dernier état poussé vers la pastille. */
function etat(): any {
  const f = mockFenetres[mockFenetres.length - 1];
  const dernier = [...f.envois].reverse().find(([canal]) => canal === "overlay:etat");
  return dernier ? (dernier[1] as any) : null;
}

function fenetre(): MockFenetre {
  return mockFenetres[mockFenetres.length - 1];
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-09-02T20:00:00Z"));
  mockTaille = { width: 1920, height: 1080 };
  mockPris.clear();
  mockFenetres.length = 0;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  overlay = require("./overlay");
  arreter = overlay.initOverlay();
});

afterEach(() => {
  // Sans cet arrêt, l'intervalle de surveillance reste ouvert et jest ne rend
  // jamais la main : un test qui prouve son point en pendant est un mauvais
  // signal en intégration continue.
  arreter();
  jest.useRealTimers();
});

/**
 * Le temps de soirée.
 *
 * Deux façons de le compter, et c'est le jeu qui décide : League publie son
 * horloge, Apex n'expose rien. Se tromper de branche fait afficher zéro sur une
 * soirée entière, ou compter les menus comme du jeu.
 */
describe("le temps joué dans la soirée", () => {
  it("suit l'horloge du jeu quand le jeu la publie", () => {
    overlay.definirEnPartie(true, "League of Legends");
    expect(etat().releve).toBe(true);

    overlay.definirReleve({ dureeSec: 600, score: null });
    expect(etat().partieSec).toBe(600);
    expect(etat().sessionSec).toBe(600);
  });

  it("verse la partie terminée au cumul, et repart de là", () => {
    overlay.definirEnPartie(true, "League of Legends");
    overlay.definirReleve({ dureeSec: 600, score: null });
    overlay.definirEnPartie(false);
    expect(etat().sessionSec).toBe(600);
    expect(etat().partieSec).toBe(0);

    overlay.definirEnPartie(true, "League of Legends");
    overlay.definirReleve({ dureeSec: 300, score: null });
    expect(etat().sessionSec).toBe(900);
  });

  /**
   * Le défaut qui a motivé le recalcul dans `envoyerEtat`, et qu'aucun test ne
   * tenait : pour un jeu sans relevé, `sessionSec` n'était mis à jour que par
   * le relevé — qui n'arrive jamais. Le moindre envoi — une dette qui bouge,
   * une capture d'écran — renvoyait le chrono à « --:-- ».
   */
  it("compte l'horloge du poste pour un jeu qui ne se raconte pas", () => {
    overlay.definirEnPartie(true, "Apex Legends");
    expect(etat().releve).toBe(false);

    jest.advanceTimersByTime(120_000);
    overlay.definirDette({ pointsDus: 40 });
    expect(etat().sessionSec).toBe(120);

    jest.advanceTimersByTime(60_000);
    overlay.signalerCapture({ ok: true, texte: "capture" });
    expect(etat().sessionSec).toBe(180);
  });

  it("garde le temps d'un jeu sans relevé une fois le jeu fermé", () => {
    overlay.definirEnPartie(true, "Apex Legends");
    jest.advanceTimersByTime(300_000);
    overlay.definirEnPartie(false);
    expect(etat().sessionSec).toBe(300);

    // L'horloge continue de tourner ; la soirée, elle, ne bouge plus.
    jest.advanceTimersByTime(600_000);
    overlay.definirDette({ pointsDus: 40 });
    expect(etat().sessionSec).toBe(300);
  });

  it("additionne deux sessions d'un jeu sans relevé", () => {
    overlay.definirEnPartie(true, "Apex Legends");
    jest.advanceTimersByTime(120_000);
    overlay.definirEnPartie(false);

    overlay.definirEnPartie(true, "Apex Legends");
    jest.advanceTimersByTime(60_000);
    overlay.definirEnPartie(false);
    expect(etat().sessionSec).toBe(180);
  });
});

/**
 * La surveillance.
 *
 * Un seul événement de fin manqué laissait la pastille au premier plan pour le
 * reste de la soirée — par-dessus le bureau, par-dessus le jeu suivant. C'est
 * le défaut déjà corrigé sur la boucle de détection, à l'autre bout de la
 * chaîne.
 */
describe("la surveillance", () => {
  it("retire une pastille affichée alors que plus rien ne tourne", () => {
    overlay.definirEnPartie(true, "League of Legends");
    overlay.afficher();
    expect(fenetre().visible).toBe(true);

    overlay.definirEnPartie(false);
    jest.advanceTimersByTime(2_000);
    expect(fenetre().visible).toBe(false);
  });

  it("ne retire pas un affichage demandé à la main", () => {
    // Quelqu'un qui appelle la pastille depuis le bureau veut la voir, même
    // sans jeu lancé : le retrait automatique ne contredit pas un geste.
    overlay.basculer();
    expect(fenetre().visible).toBe(true);

    jest.advanceTimersByTime(10_000);
    expect(fenetre().visible).toBe(true);
  });

  /**
   * Le cas qui distingue vraiment `enPlacement` du reste.
   *
   * Le mode placement passe par `afficher({ parLUtilisateur: true })`, donc il
   * est d'abord protégé par `manuel` — et un test qui s'arrête là passe même
   * sans la condition qu'il prétend éprouver. Il faut PERDRE `manuel` : c'est
   * ce que fait une partie qui démarre. Quand elle s'achève, la pastille est
   * encore attrapée à la souris, et seul `enPlacement` la retient à l'écran.
   */
  it("ne retire pas la pastille pendant qu'on la déplace", () => {
    overlay.definirPlacement(true);
    overlay.definirEnPartie(true, "League of Legends");
    overlay.definirEnPartie(false);
    expect(fenetre().visible).toBe(true);

    jest.advanceTimersByTime(10_000);
    expect(fenetre().visible).toBe(true);
  });

  it("remontre une pastille que le jeu a fait disparaître", () => {
    overlay.definirEnPartie(true, "League of Legends");
    overlay.afficher();
    // Le plein écran exclusif décompose la fenêtre : elle n'est plus visible
    // sans que personne ne l'ait masquée.
    fenetre().visible = false;

    jest.advanceTimersByTime(2_000);
    expect(fenetre().visible).toBe(true);
  });

  it("ne la réaffirme pas pendant qu'elle est à l'écran", () => {
    // Réaffirmer le premier plan à chaque tour pendant que le jeu tient
    // l'écran provoque une alternance visible.
    overlay.definirEnPartie(true, "League of Legends");
    overlay.afficher();
    const avant = fenetre().montrees;

    jest.advanceTimersByTime(10_000);
    expect(fenetre().montrees).toBe(avant);
  });
});

/**
 * Le message de capture.
 *
 * L'Assistant de concentration de Windows supprime les notifications dès qu'un
 * jeu tourne : la pastille est le seul endroit où l'on puisse dire que la
 * touche a été prise en compte. Elle se montre pour le message SEULEMENT — sans
 * quoi la surveillance croirait à un affichage voulu et le maintiendrait.
 */
describe("le message de capture", () => {
  it("montre la pastille sans la vouloir", () => {
    overlay.signalerCapture({ ok: true, texte: "Capture enregistrée" });
    expect(fenetre().visible).toBe(true);

    // La preuve que `voulu` n'a pas bougé : la bascule MONTRE au lieu de
    // masquer. Si le message l'avait posé à vrai, elle masquerait.
    overlay.basculer();
    expect(fenetre().visible).toBe(true);
  });

  it("la retire d'elle-même au bout de deux secondes et demie", () => {
    overlay.signalerCapture({ ok: true, texte: "Capture enregistrée" });
    jest.advanceTimersByTime(2_600);
    expect(fenetre().visible).toBe(false);
  });

  it("repousse le retrait quand un second message arrive", () => {
    overlay.signalerCapture({ ok: true, texte: "premier" });
    jest.advanceTimersByTime(2_000);
    overlay.signalerCapture({ ok: true, texte: "second" });

    // Sans le minuteur remis à zéro, celui du premier message masquerait la
    // pastille six cents millisecondes après le second.
    jest.advanceTimersByTime(1_000);
    expect(fenetre().visible).toBe(true);

    jest.advanceTimersByTime(1_600);
    expect(fenetre().visible).toBe(false);
  });

  it("ne masque pas une pastille qu'on voulait déjà", () => {
    overlay.definirEnPartie(true, "League of Legends");
    overlay.afficher();
    overlay.signalerCapture({ ok: true, texte: "Capture enregistrée" });

    jest.advanceTimersByTime(10_000);
    expect(fenetre().visible).toBe(true);
  });

  it("porte le texte et son issue jusqu'à la pastille", () => {
    overlay.signalerCapture({ ok: false, texte: "Rien à lire" });
    expect(etat().capture.ok).toBe(false);
    expect(etat().capture.texte).toBe("Rien à lire");
  });
});

/** Le mode placement, et ce qu'il retient. */
describe("le placement à la main", () => {
  it("rend la pastille attrapable, et la montre", () => {
    overlay.definirPlacement(true);
    expect(fenetre().visible).toBe(true);
    expect(fenetre().ignoreSouris).toBe(false);
    expect(fenetre().focusable).toBe(true);
  });

  it("retient où elle a été posée, et la range hors partie", () => {
    overlay.definirPlacement(true);
    fenetre().setBounds({ x: 640, y: 320 });

    const apres = overlay.definirPlacement(false);
    expect(apres.libre).toBe(true);
    expect(apres.position).toEqual({ x: 640, y: 320 });
    expect(fenetre().visible).toBe(false);
    expect(fenetre().ignoreSouris).toBe(true);
  });

  it("la laisse à l'écran quand une partie tourne", () => {
    overlay.definirEnPartie(true, "League of Legends");
    overlay.definirPlacement(true);
    overlay.definirPlacement(false);
    expect(fenetre().visible).toBe(true);
  });

  it("un coin choisi annule la position posée à la main", () => {
    // Garder les deux reviendrait à ignorer le clic qu'on vient de recevoir.
    overlay.definirPlacement(true);
    fenetre().setBounds({ x: 640, y: 320 });
    overlay.definirPlacement(false);

    overlay.definirCoin("bas-gauche");
    expect(overlay.lirePlacement().libre).toBe(false);
    expect(overlay.lirePlacement().position).toBeNull();
  });

  it("le raccourci fait le tour des quatre coins", () => {
    const vus = [overlay.coinSuivant(), overlay.coinSuivant(),
      overlay.coinSuivant(), overlay.coinSuivant()];
    expect(new Set(vus).size).toBe(4);
    expect(vus[3]).toBe(overlay.COINS[0]);
  });
});

/**
 * La chaîne de repli des raccourcis.
 *
 * Discord, GeForce et Steam tiennent couramment les combinaisons évidentes. Un
 * raccourci global échoue en SILENCE : on appuie, il ne se passe rien, et rien
 * ne le dit. C'est pourquoi celui qui a été retenu se lit.
 */
describe("les raccourcis", () => {
  it("prend le premier libre", () => {
    expect(overlay.lireRaccourcis()).toEqual({
      bascule: "Control+Shift+O", coin: "Control+Shift+P",
    });
  });

  it("descend la liste quand les premiers sont pris", () => {
    arreter();
    jest.resetModules();
    mockPris.add("Control+Shift+O");
    mockPris.add("Alt+Shift+O");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    overlay = require("./overlay");
    arreter = overlay.initOverlay();

    expect(overlay.lireRaccourcis().bascule).toBe("Control+Alt+O");
  });

  it("l'avoue quand aucune combinaison n'est libre", () => {
    arreter();
    jest.resetModules();
    for (const c of ["Control+Shift+O", "Alt+Shift+O", "Control+Alt+O", "Alt+O"]) mockPris.add(c);
    const avertir = jest.spyOn(console, "warn").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    overlay = require("./overlay");
    arreter = overlay.initOverlay();

    expect(overlay.lireRaccourcis().bascule).toBeNull();
    expect(avertir).toHaveBeenCalled();
    avertir.mockRestore();
  });
});
