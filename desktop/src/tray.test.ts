/**
 * Le menu de la zone de notification, qui est le seul écran qui subsiste
 * quand la fenêtre est fermée.
 *
 * Deux choses s'y jouent, et aucune n'était tenue :
 *
 * - **la langue.** Le menu est construit AU DÉMARRAGE, avant que la fenêtre
 *   ait chargé la moindre page, donc avant qu'on sache quoi que ce soit de la
 *   langue choisie. D'où la langue passée en fonction et le menu reconstruit
 *   ensuite. Le commentaire l'a promis avant que le code le fasse — c'est
 *   écrit dans le journal — et rien ne l'aurait redit ;
 * - **l'avertissement de mise en veille.** Une fois par session : jamais, et
 *   on croit avoir quitté en fermant la fenêtre ; à chaque fois, et c'est un
 *   harcèlement qu'on finit par couper.
 *
 * `electron` est doublé ; rien ici ne demande d'écran.
 */

// Fait de ce fichier un MODULE : sans ça, TypeScript le traite comme un
// script et ses noms de premier niveau entrent dans la portée globale, où
// ils entrent en collision avec ceux d'un autre fichier de test. Jest ne
// s'en aperçoit pas — chaque fichier y a sa propre portée — c'est `tsc` qui
// le dit.
export {};
type Entree = { label?: string; type?: string; checked?: boolean; click?: (i: unknown) => void };

const espion = {
  menus: [] as Entree[][],
  notifications: [] as { title: string; body: string }[],
  detruit: false,
  ecoutes: [] as string[],
};

jest.mock("electron", () => ({
  app: { getPath: () => "/tmp" },
  nativeImage: { createFromPath: () => ({}) },
  Menu: { buildFromTemplate: (m: Entree[]) => m },
  Tray: class {
    setToolTip() {}
    setContextMenu(m: Entree[]) { espion.menus.push(m); }
    on(nom: string) { espion.ecoutes.push(nom); }
    isDestroyed() { return espion.detruit; }
    destroy() { espion.detruit = true; }
  },
  Notification: class {
    static isSupported() { return true; }
    constructor(private o: { title: string; body: string }) {}
    show() { espion.notifications.push(this.o); }
  },
}), { virtual: true });

/** Charge le module à neuf : `previenuUneFois` vit au niveau du module. */
function moduleNeuf() {
  let m!: typeof import("./tray.js");
  jest.isolateModules(() => { m = require("./tray.js"); });
  return m;
}

const actions = (extra: Record<string, unknown> = {}) => ({
  ouvrir: jest.fn(), quitter: jest.fn(),
  overlayActif: () => true, setOverlayActif: jest.fn(),
  basculerOverlay: jest.fn(), raccourci: "Alt+D",
  langue: "fr", ...extra,
});

const libelles = (m: Entree[]) => m.map((e) => e.label).filter(Boolean) as string[];

beforeEach(() => {
  espion.menus.length = 0;
  espion.notifications.length = 0;
  espion.ecoutes.length = 0;
  espion.detruit = false;
});

describe("le menu", () => {
  it("se construit dès la pose de l'icône", () => {
    moduleNeuf().initTray(actions());
    expect(espion.menus).toHaveLength(1);
    expect(libelles(espion.menus[0]).length).toBeGreaterThan(3);
  });

  /** Le double-clic est le geste attendu sous Windows pour rouvrir. */
  it("répond au double-clic", () => {
    moduleNeuf().initTray(actions());
    expect(espion.ecoutes).toContain("double-click");
  });

  /**
   * La langue vient en RETARD, et c'est tout le problème : l'icône est posée
   * avant que la fenêtre ait chargé quoi que ce soit. Une langue lue une seule
   * fois à l'ouverture fige le menu en anglais pour toujours.
   */
  it("relit la langue à chaque construction", () => {
    let langue = "en";
    const { rafraichir } = moduleNeuf().initTray(actions({ langue: () => langue }));
    const enAnglais = libelles(espion.menus[0]).join(" ");

    langue = "de";
    rafraichir();
    const enAllemand = libelles(espion.menus[1]).join(" ");
    expect(enAllemand).not.toBe(enAnglais);
  });

  /** Cocher l'overlay enregistre ET reconstruit, pour montrer l'état réel. */
  it("reconstruit le menu après une bascule de réglage", () => {
    const set = jest.fn();
    moduleNeuf().initTray(actions({ setOverlayActif: set }));
    const bascule = espion.menus[0].find((e) => e.type === "checkbox");
    bascule?.click?.({ checked: false });
    expect(set).toHaveBeenCalledWith(false);
    expect(espion.menus).toHaveLength(2);
  });

  /**
   * Les entrées de capture n'existent que si l'action existe. Un menu qui
   * propose ce qui n'est pas branché est pire qu'un menu court : on clique, et
   * il ne se passe rien.
   */
  it("n'affiche que ce qui est branché", () => {
    const sans = moduleNeuf();
    sans.initTray(actions());
    const court = libelles(espion.menus[0]).length;

    espion.menus.length = 0;
    const avec = moduleNeuf();
    avec.initTray(actions({
      capturer: jest.fn(), ouvrirCaptures: jest.fn(),
      lireEcran: jest.fn(), releveActif: () => false, setReleveActif: jest.fn(),
    }));
    expect(libelles(espion.menus[0]).length).toBeGreaterThan(court);
  });

  it("ne touche plus à rien une fois arrêté", () => {
    const { arreter, rafraichir } = moduleNeuf().initTray(actions());
    arreter();
    const apres = espion.menus.length;
    rafraichir();
    expect(espion.menus).toHaveLength(apres);
    expect(() => arreter()).not.toThrow();
  });
});

describe("l'avertissement de mise en veille", () => {
  it("prévient la première fois", () => {
    moduleNeuf().signalerVeille("fr");
    expect(espion.notifications).toHaveLength(1);
    expect(espion.notifications[0].title).toBeTruthy();
  });

  /**
   * Et une seule. Redire à chaque fermeture « je tourne toujours » est le
   * genre de chose qu'on coupe, et on coupe alors tout le reste avec.
   */
  it("ne prévient qu'une fois par session", () => {
    const m = moduleNeuf();
    m.signalerVeille("fr");
    m.signalerVeille("fr");
    m.signalerVeille("fr");
    expect(espion.notifications).toHaveLength(1);
  });

  it("parle la langue demandée", () => {
    const fr = moduleNeuf();
    fr.signalerVeille("fr");
    const titreFr = espion.notifications[0].title;
    espion.notifications.length = 0;
    const de = moduleNeuf();
    de.signalerVeille("de");
    expect(espion.notifications[0].title).not.toBe(titreFr);
  });
});
