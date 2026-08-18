// Détection des jeux en cours d'exécution.
//
// On lit la liste des processus, comme le fait le gestionnaire des tâches. Rien
// n'est injecté, aucun processus n'est ouvert ni modifié : il n'y a donc rien
// qu'un anti-cheat puisse reprocher, et aucun droit administrateur n'est requis.
//
// C'est ce qui permet de démarrer un suivi au lancement du jeu plutôt que
// d'attendre un clic — mais cela suppose que cette application tourne déjà.
// Windows n'offre à un programme ordinaire aucun moyen d'être réveillé par le
// démarrage d'un autre ; les mécanismes qui existent (consommateurs
// d'événements WMI permanents, tâches déclenchées par le journal d'audit)
// demandent des droits d'administration et sont ceux qu'utilisent les logiciels
// de persistance malveillants.

const { execFile } = require("child_process");

/**
 * Exécutable de chaque jeu du catalogue.
 *
 * Trois cas sont ambigus et le resteront, faute de signal distinctif :
 *   - Teamfight Tactics tourne dans le même exécutable que League of Legends ;
 *   - Warzone partage `cod.exe` avec Call of Duty ;
 *   - Minecraft Java s'exécute dans `javaw.exe`, que partagent tous les
 *     programmes Java — on ne surveille donc que l'édition Windows.
 * Surveiller les deux jeux d'une paire ambiguë revient à surveiller le même
 * processus : le premier de la liste l'emporte.
 */
const EXECUTABLES = {
  "League of Legends": ["League of Legends.exe"],
  "Teamfight Tactics": ["League of Legends.exe"],
  "Valorant": ["VALORANT-Win64-Shipping.exe"],
  "Counter-Strike 2": ["cs2.exe"],
  "Fortnite": ["FortniteClient-Win64-Shipping.exe"],
  "Apex Legends": ["r5apex.exe", "r5apex_dx12.exe"],
  "PUBG": ["TslGame.exe"],
  "Call of Duty: Warzone": ["cod.exe"],
  "Call of Duty": ["cod.exe"],
  "Rocket League": ["RocketLeague.exe"],
  "Minecraft": ["Minecraft.Windows.exe"],
  "World of Warcraft": ["Wow.exe"],
  "Grand Theft Auto V": ["GTA5.exe", "GTA5_Enhanced.exe"],
  "Elden Ring": ["eldenring.exe"],
  "Les Sims": ["TS4_x64.exe"],
};

/** Intervalle de scrutation. Assez court pour être réactif, assez long pour ne rien coûter. */
const PERIODE_MS = 10_000;

/** Liste les noms de processus en cours, en minuscules. */
function processusEnCours() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve(new Set());
    execFile("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return resolve(new Set());
        const noms = new Set();
        for (const ligne of stdout.split("\n")) {
          // Format CSV : "nom.exe","1234","Console",... — seul le premier champ compte.
          const m = ligne.match(/^"([^"]+)"/);
          if (m) noms.add(m[1].toLowerCase());
        }
        resolve(noms);
      });
  });
}

/**
 * Surveille les jeux demandés et signale leurs démarrages et arrêts.
 *
 * @param {() => string[]} listerJeux Les jeux à surveiller, relus à chaque tour
 *   pour que décocher une case prenne effet sans redémarrer la surveillance.
 * @param {(evenement: { type: "jeu-demarre" | "jeu-arrete", jeu: string }) => void} signaler
 * @returns {() => void} Arrête la surveillance.
 */
function surveillerJeux(listerJeux, signaler) {
  // Jeux vus tourner au tour précédent : c'est la transition qui nous intéresse,
  // pas l'état. Sans ça, on signalerait un démarrage toutes les dix secondes.
  let actifs = new Set();
  let arrete = false;

  const tour = async () => {
    if (arrete) return;
    const surveilles = listerJeux();
    if (surveilles.length === 0) {
      actifs = new Set();
      return;
    }

    const enCours = await processusEnCours();
    const maintenant = new Set();
    for (const jeu of surveilles) {
      const exes = EXECUTABLES[jeu];
      if (!exes) continue;
      if (exes.some((exe) => enCours.has(exe.toLowerCase()))) maintenant.add(jeu);
    }

    for (const jeu of maintenant) {
      if (!actifs.has(jeu)) signaler({ type: "jeu-demarre", jeu });
    }
    for (const jeu of actifs) {
      if (!maintenant.has(jeu)) signaler({ type: "jeu-arrete", jeu });
    }
    actifs = maintenant;
  };

  tour();
  const minuteur = setInterval(tour, PERIODE_MS);

  return () => {
    arrete = true;
    clearInterval(minuteur);
  };
}

/** Jeux dont le lancement peut être détecté sur cette machine. */
function jeuxDetectables() {
  return process.platform === "win32" ? Object.keys(EXECUTABLES) : [];
}

module.exports = { surveillerJeux, jeuxDetectables, EXECUTABLES };
