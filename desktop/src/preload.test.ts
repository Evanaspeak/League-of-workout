/**
 * Ce que le pont fait vraiment quand un événement arrive.
 *
 * `pontContrat.test.ts` vérifie la FORME du pont ; celui-ci vérifie son
 * comportement, et deux choses seulement, parce que ce sont les deux qui
 * peuvent mal tourner sans bruit :
 *
 * - **le filtrage par type.** Un seul canal, `lol:event`, porte le début et la
 *   fin de partie. Si le filtre saute, `onGameStarted` se déclenche à la FIN
 *   d'une partie : la page ouvre une session de jeu au moment où elle devrait
 *   la fermer, et personne ne fait le lien ;
 * - **le désabonnement.** La page monte et démonte ces écouteurs au fil de la
 *   navigation. Une fonction de retrait qui ne retire rien laisse s'empiler des
 *   rappels sur des composants démontés, et le symptôme — une partie
 *   enregistrée plusieurs fois — ne ressemble pas à sa cause.
 *
 * `electron` est doublé : rien ici ne demande une fenêtre.
 */

// Fait de ce fichier un MODULE : sans ça, TypeScript le traite comme un
// script et ses noms de premier niveau entrent dans la portée globale, où
// ils entrent en collision avec ceux d'un autre fichier de test. Jest ne
// s'en aperçoit pas — chaque fichier y a sa propre portée — c'est `tsc` qui
// le dit.
export {};
type Ecouteur = (evenement: unknown, charge: unknown) => void;

const canaux = new Map<string, Ecouteur[]>();
const exposees: Record<string, unknown> = {};

jest.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (_nom: string, api: Record<string, unknown>) => {
      Object.assign(exposees, api);
    },
  },
  ipcRenderer: {
    on: (canal: string, f: Ecouteur) => {
      canaux.set(canal, [...(canaux.get(canal) ?? []), f]);
    },
    removeListener: (canal: string, f: Ecouteur) => {
      canaux.set(canal, (canaux.get(canal) ?? []).filter((g) => g !== f));
    },
    send: jest.fn(),
    invoke: jest.fn(),
  },
}), { virtual: true });

require("./preload.js");

/** Simule un message venu du processus principal. */
function emettre(canal: string, charge: unknown) {
  for (const f of [...(canaux.get(canal) ?? [])]) f(null, charge);
}

const pont = exposees as {
  onGameStarted: (f: (p: unknown) => void) => () => void;
  onGameEnded: (f: (p: unknown) => void) => () => void;
  onPartieTerminee: (f: (p: Record<string, unknown>) => void) => () => void;
};

beforeEach(() => { for (const [c, l] of canaux) if (l.length) canaux.set(c, []); });

describe("le filtrage par type", () => {
  it("ne réveille que l'écouteur du bon type", () => {
    const debut = jest.fn();
    const fin = jest.fn();
    pont.onGameStarted(debut);
    pont.onGameEnded(fin);

    emettre("lol:event", { type: "game-started" });
    expect(debut).toHaveBeenCalledTimes(1);
    expect(fin).not.toHaveBeenCalled();

    emettre("lol:event", { type: "game-ended" });
    expect(debut).toHaveBeenCalledTimes(1);
    expect(fin).toHaveBeenCalledTimes(1);
  });

  /** Un message vide arrive : il ne doit rien déclencher, et rien casser. */
  it("ne tombe pas sur un message sans type", () => {
    const debut = jest.fn();
    pont.onGameStarted(debut);
    expect(() => emettre("lol:event", null)).not.toThrow();
    expect(() => emettre("lol:event", { rien: 1 })).not.toThrow();
    expect(debut).not.toHaveBeenCalled();
  });
});

describe("le désabonnement", () => {
  it("retire vraiment l'écouteur", () => {
    const f = jest.fn();
    const retirer = pont.onGameEnded(f);
    emettre("lol:event", { type: "game-ended" });
    expect(f).toHaveBeenCalledTimes(1);

    retirer();
    emettre("lol:event", { type: "game-ended" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  /** Deux abonnements du même rappel se retirent indépendamment. */
  it("ne retire que le sien", () => {
    const a = jest.fn();
    const b = jest.fn();
    const retirerA = pont.onGameEnded(a);
    pont.onGameEnded(b);
    retirerA();
    emettre("lol:event", { type: "game-ended" });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe("la fin de partie remise à la page", () => {
  /**
   * Le contexte voyage À CÔTÉ de la partie et doit la rejoindre : c'est lui
   * qui porte le rôle et la file lus sur le lanceur. Sans lui, le rôle
   * retombait sur une constante, et un support payait ses morts au tarif d'un
   * jungler.
   */
  it("recolle le contexte à la partie", () => {
    const f = jest.fn();
    pont.onPartieTerminee(f);
    emettre("lol:event", {
      type: "game-ended",
      partie: { result: "V", champion: "Ahri" },
      contexte: { role: "Support", file: { nom: "ARAM" } },
    });
    expect(f).toHaveBeenCalledWith({
      result: "V", champion: "Ahri",
      contexte: { role: "Support", file: { nom: "ARAM" } },
    });
  });

  /** Sans contexte, la partie part quand même — avec `null`, pas `undefined`. */
  it("remet null quand le lanceur n'a rien dit", () => {
    const f = jest.fn();
    pont.onPartieTerminee(f);
    emettre("lol:event", { type: "game-ended", partie: { result: "D" } });
    expect(f).toHaveBeenCalledWith({ result: "D", contexte: null });
  });

  it("ignore une fin de partie qui n'en est pas une", () => {
    const f = jest.fn();
    pont.onPartieTerminee(f);
    emettre("lol:event", { type: "game-started", partie: { result: "V" } });
    expect(f).not.toHaveBeenCalled();
  });
});
