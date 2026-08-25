// `export {}` fait de ce fichier un module : sans lui, ses `const` de tête
// vivent dans la portée globale et se heurtent à celles des autres tests.
export {};

// La détection des jeux par la liste des processus. C'est elle qui ouvre la
// pastille et le suivi de séance sur tous les jeux qui ne se racontent pas.

const { surveillerJeux, EXECUTABLES, jeuxDetectables } = require("./jeuxProcessus");

type Evenement = { type: string; jeu: string };
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

function monter(jeux: string[], processus: () => Set<string>) {
  const vus: Evenement[] = [];
  let liste = jeux;
  const arreter = surveillerJeux(
    () => liste,
    (e: Evenement) => vus.push(e),
    { lireProcessus: async () => processus(), periodeMs: 1 },
  );
  return { vus, arreter, changerListe: (l: string[]) => { liste = l; } };
}

describe("la détection des jeux", () => {
  it("signale un démarrage une seule fois, puis l'arrêt", async () => {
    let ouvert = false;
    const { vus, arreter } = monter(["Apex Legends"], () => new Set(ouvert ? ["r5apex.exe"] : []));
    await attendre(10);
    ouvert = true;
    await attendre(15);
    ouvert = false;
    await attendre(15);
    arreter();

    expect(vus.filter((e) => e.type === "jeu-demarre")).toHaveLength(1);
    expect(vus.filter((e) => e.type === "jeu-arrete")).toHaveLength(1);
  });

  it("reconnaît un jeu à l'un quelconque de ses exécutables", async () => {
    // Apex a deux binaires selon l'API graphique choisie ; n'en connaître
    // qu'un fait rater une moitié des joueurs.
    const { vus, arreter } = monter(["Apex Legends"], () => new Set(["r5apex_dx12.exe"]));
    await attendre(10);
    arreter();
    expect(vus[0]).toEqual({ type: "jeu-demarre", jeu: "Apex Legends" });
  });

  it("compare les noms sans tenir compte de la casse", async () => {
    const { vus, arreter } = monter(["Valorant"], () => new Set(["valorant-win64-shipping.exe"]));
    await attendre(10);
    arreter();
    expect(vus[0]?.type).toBe("jeu-demarre");
  });

  it("dit que le jeu s'arrête quand on le décoche en pleine partie", async () => {
    // Le défaut : l'état était vidé SANS rien signaler. Personne n'apprenait
    // que le jeu s'était arrêté, et la pastille restait à l'écran.
    const { vus, arreter, changerListe } = monter(["Apex Legends"], () => new Set(["r5apex.exe"]));
    await attendre(10);
    expect(vus.filter((e) => e.type === "jeu-demarre")).toHaveLength(1);
    changerListe([]);
    await attendre(10);
    arreter();

    expect(vus.filter((e) => e.type === "jeu-arrete")).toEqual([
      { type: "jeu-arrete", jeu: "Apex Legends" },
    ]);
  });

  it("n'empile pas les tours quand la liste des processus est lente", async () => {
    let enVol = 0;
    let maxEnVol = 0;
    const vus: Evenement[] = [];
    const arreter = surveillerJeux(() => ["Apex Legends"], (e: Evenement) => vus.push(e), {
      lireProcessus: async () => {
        enVol += 1;
        maxEnVol = Math.max(maxEnVol, enVol);
        await attendre(25);
        enVol -= 1;
        return new Set<string>();
      },
      periodeMs: 1,
    });
    await attendre(110);
    arreter();
    expect(maxEnVol).toBe(1);
  });

  it("ne prétend pas détecter quoi que ce soit hors de Windows", () => {
    // Le catalogue existe toujours, mais la détection repose sur `tasklist`.
    expect(jeuxDetectables()).toEqual(process.platform === "win32" ? Object.keys(EXECUTABLES) : []);
  });
});
