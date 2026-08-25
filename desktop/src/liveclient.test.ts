// `export {}` fait de ce fichier un module : sans lui, ses `const` de tête
// vivent dans la portée globale et se heurtent à celles des autres tests.
export {};

// La boucle qui détecte les parties de League. Elle n'avait aucun test : elle
// ne s'éprouvait qu'en lançant le jeu, c'est-à-dire jamais ici.

const { startLiveClientWatcher } = require("./liveclient");

type Evenement = { type: string; partie?: { resultat?: string | null; score?: unknown } };

const partie = (evenements: unknown[] = []) => ({
  gameData: { gameTime: 1800 },
  activePlayer: { riotIdGameName: "Moi" },
  allPlayers: [{ riotIdGameName: "Moi", championName: "Ahri", scores: { kills: 5, deaths: 2, assists: 7, creepScore: 180 } }],
  events: { Events: evenements },
});

const finGagnee = [{ EventName: "GameEnd", Result: "Win" }];

/** Laisse tourner les tours en attente. */
const respirer = () => new Promise((r) => setTimeout(r, 0));

describe("la surveillance de la partie en cours", () => {
  it("signale le début, puis la fin avec le dernier relevé", async () => {
    const vus: Evenement[] = [];
    const reponses = [partie(), partie(finGagnee), null];
    let i = 0;
    const arreter = startLiveClientWatcher((e: Evenement) => vus.push(e), {
      lire: async () => reponses[Math.min(i++, reponses.length - 1)],
      periodeMs: 1,
    });
    await new Promise((r) => setTimeout(r, 40));
    arreter();

    const debut = vus.find((e) => e.type === "game-started");
    const fin = vus.find((e) => e.type === "game-ended");
    expect(debut).toBeDefined();
    expect(fin?.partie?.resultat).toBe("V");
  });

  it("ne perd pas l'issue quand le dernier relevé ne la porte plus", async () => {
    // Le cas qui faisait enregistrer des victoires en défaites : un relevé
    // sans l'événement suffisait à effacer la lecture d'avant.
    const vus: Evenement[] = [];
    const reponses = [partie(finGagnee), partie(), null];
    let i = 0;
    const arreter = startLiveClientWatcher((e: Evenement) => vus.push(e), {
      lire: async () => reponses[Math.min(i++, reponses.length - 1)],
      periodeMs: 1,
    });
    await new Promise((r) => setTimeout(r, 40));
    arreter();

    expect(vus.find((e) => e.type === "game-ended")?.partie?.resultat).toBe("V");
  });

  it("n'empile pas les tours quand le client répond lentement", async () => {
    // La scrutation est passée à deux secondes, le délai d'expiration d'une
    // requête est de trois : sans verrou, les tours se chevauchent et l'ordre
    // des relevés n'est plus garanti.
    let enVol = 0;
    let maxEnVol = 0;
    const arreter = startLiveClientWatcher(() => {}, {
      lire: async () => {
        enVol += 1;
        maxEnVol = Math.max(maxEnVol, enVol);
        await new Promise((r) => setTimeout(r, 30));
        enVol -= 1;
        return partie();
      },
      periodeMs: 1,
    });
    await new Promise((r) => setTimeout(r, 120));
    arreter();

    expect(maxEnVol).toBe(1);
  });

  it("s'arrête pour de bon quand on lui demande", async () => {
    let appels = 0;
    const arreter = startLiveClientWatcher(() => {}, {
      lire: async () => { appels += 1; return null; },
      periodeMs: 1,
    });
    await respirer();
    arreter();
    const gele = appels;
    await new Promise((r) => setTimeout(r, 30));
    expect(appels).toBe(gele);
  });
});
