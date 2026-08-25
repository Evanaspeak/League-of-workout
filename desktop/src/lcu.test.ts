// `export {}` fait de ce fichier un module : sans lui, ses `const` de tête
// vivent dans la portée globale et se heurtent à celles des autres tests.
export {};

// La surveillance du lanceur League. Elle porte la seconde source d'issue de
// partie, celle qui parle quand l'API de partie s'est déjà tue — c'est-à-dire
// la pièce ajoutée pour que les victoires cessent d'être enregistrées en
// défaites. Elle n'avait aucun test.

const { surveillerClient } = require("./lcu");

type Signal = { type: string; phase?: string | null; resultat?: string | null; motif?: string };

const IDS = { port: "1", motDePasse: "x" };
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Un lanceur simulé : on lui dit quoi répondre, chemin par chemin. */
function lanceur(reponses: Record<string, unknown>) {
  const appels: string[] = [];
  return {
    appels,
    demander: async (_ids: unknown, chemin: string) => {
      appels.push(chemin);
      return reponses[chemin] ?? null;
    },
  };
}

const FIN = { phase: "EndOfGame", gameData: {} };
const BLOC_VICTOIRE = {
  teams: [{ isPlayerTeam: true, isWinningTeam: true }],
  localPlayer: { stats: { WIN: 1 } },
};

describe("la surveillance du lanceur", () => {
  it("publie l'issue lue sur l'écran de fin", async () => {
    const vus: Signal[] = [];
    const faux = lanceur({
      "/lol-gameflow/v1/session": FIN,
      "/lol-end-of-game/v1/eog-stats-block": BLOC_VICTOIRE,
    });
    const arreter = surveillerClient((e: Signal) => vus.push(e), {
      demander: faux.demander, identifiants: async () => IDS, periodeMs: 1,
    });
    await attendre(30);
    arreter();

    expect(vus.find((e) => e.type === "issue")).toEqual({ type: "issue", resultat: "V", motif: null });
  });

  it("ne la lit qu'une fois par partie", async () => {
    // L'écran de fin reste affiché plusieurs secondes : sans garde, la même
    // partie serait publiée à chaque tour.
    const vus: Signal[] = [];
    const faux = lanceur({
      "/lol-gameflow/v1/session": FIN,
      "/lol-end-of-game/v1/eog-stats-block": BLOC_VICTOIRE,
    });
    const arreter = surveillerClient((e: Signal) => vus.push(e), {
      demander: faux.demander, identifiants: async () => IDS, periodeMs: 1,
    });
    await attendre(40);
    arreter();

    expect(vus.filter((e) => e.type === "issue")).toHaveLength(1);
  });

  it("retente au tour suivant quand l'écran de fin n'est pas encore rempli", async () => {
    // Un « inconnu » ne se publie pas : la page n'est peut-être pas prête.
    const vus: Signal[] = [];
    let prete = false;
    const arreter = surveillerClient((e: Signal) => vus.push(e), {
      demander: async (_i: unknown, chemin: string) => {
        if (chemin === "/lol-gameflow/v1/session") return FIN;
        if (chemin === "/lol-end-of-game/v1/eog-stats-block") {
          if (!prete) { prete = true; return {}; }
          return BLOC_VICTOIRE;
        }
        return null;
      },
      identifiants: async () => IDS, periodeMs: 1,
    });
    await attendre(40);
    arreter();

    // Compter ne suffit pas : avec le garde retiré, un « inconnu » serait
    // publié au premier tour, `issueLue` passerait à vrai, et le compte
    // resterait à un. Le sabotage passait. C'est le CONTENU qui distingue.
    const issues = vus.filter((e) => e.type === "issue");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({ type: "issue", resultat: "V", motif: null });
  });

  it("ne demande pas l'écran de fin hors des phases de fin", async () => {
    const faux = lanceur({ "/lol-gameflow/v1/session": { phase: "InProgress", gameData: {} } });
    const arreter = surveillerClient(() => {}, {
      demander: faux.demander, identifiants: async () => IDS, periodeMs: 1,
    });
    await attendre(30);
    arreter();

    expect(faux.appels).not.toContain("/lol-end-of-game/v1/eog-stats-block");
  });

  it("n'empile pas les tours quand le lanceur répond lentement", async () => {
    let enVol = 0;
    let maxEnVol = 0;
    const arreter = surveillerClient(() => {}, {
      demander: async () => {
        enVol += 1;
        maxEnVol = Math.max(maxEnVol, enVol);
        await attendre(25);
        enVol -= 1;
        return null;
      },
      identifiants: async () => IDS, periodeMs: 1,
    });
    await attendre(110);
    arreter();

    expect(maxEnVol).toBe(1);
  });
});
