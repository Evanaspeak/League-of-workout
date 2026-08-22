// Capture de l'écran, pour lire les chiffres qu'Apex affiche.
//
// Aucun jeu de tir moderne n'expose ses données à un programme tiers : là où
// League ouvre une API locale, Apex n'offre rien. Le seul endroit où les
// éliminations et le classement existent est l'écran lui-même.
//
// Ce que fait ce module : demander à Windows une image de l'écran, exactement
// comme le font un logiciel de diffusion ou un partage d'écran. Rien n'est
// injecté, la mémoire du jeu n'est pas lue, son processus n'est pas ouvert —
// ce sont ces trois gestes-là qu'un anti-triche surveille, et aucun n'a lieu.
// Lire son propre écran pour compter des pompes ne donne d'ailleurs aucun
// avantage en jeu : rien n'y est révélé que le joueur ne voie déjà.
//
// La même limite que l'overlay s'applique : en plein écran EXCLUSIF, le jeu
// contourne le compositeur et l'image rendue est noire ou figée. En sans
// bordure — ou en plein écran avec les optimisations de Windows 10/11 — la
// capture fonctionne.

const { desktopCapturer, screen, globalShortcut, app } = require("electron");
const path = require("path");
const fs = require("fs");

/**
 * Où atterrissent les captures.
 *
 * Dans les images de l'utilisateur, pas dans les données de l'application :
 * ces fichiers sont faits pour être ouverts, regardés et envoyés. Enfouis dans
 * `AppData`, personne ne les retrouve.
 */
function dossier() {
  const base = path.join(app.getPath("pictures"), "Win or Workout");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

/** Horodatage triable et lisible : 2026-08-22_19h04m12s. */
function horodatage() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    + `_${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}s`;
}

/**
 * Une image de l'écran principal, à sa résolution physique.
 *
 * `thumbnailSize` porte mal son nom : c'est la taille de l'image rendue, et
 * la laisser par défaut donne une vignette de 150 pixels — inexploitable pour
 * lire des chiffres. On demande donc la taille réelle, facteur d'échelle
 * compris : sur un écran à 150 %, la largeur logique n'est pas celle des
 * pixels, et c'est en pixels que se lisent les caractères.
 */
async function imageEcran() {
  const ecran = screen.getPrimaryDisplay();
  const facteur = ecran.scaleFactor || 1;
  const taille = {
    width: Math.round(ecran.size.width * facteur),
    height: Math.round(ecran.size.height * facteur),
  };
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: taille });
  if (!sources.length) return null;
  // L'écran principal en premier quand on peut l'identifier ; sinon le premier
  // venu, ce qui est le cas courant d'un poste à un seul écran.
  const source = sources.find((s) => String(s.display_id) === String(ecran.id)) ?? sources[0];
  return source.thumbnail;
}

/**
 * Enregistre une capture et rend son chemin, ou `null` si l'image est vide.
 *
 * Une image entièrement noire est le symptôme du plein écran exclusif. La
 * signaler vaut mieux que d'écrire un fichier inutile que personne ne pensera
 * à ouvrir avant de me l'envoyer.
 */
async function capturer(etiquette = "ecran") {
  const image = await imageEcran();
  if (!image || image.isEmpty()) return { chemin: null, raison: "aucune image" };

  const png = image.toPNG();
  // Une capture de plein écran exclusif revient noire. Le test est grossier
  // mais suffit : un PNG entièrement noir se compresse à presque rien.
  if (png.length < 20_000) {
    return { chemin: null, raison: "écran noir — le jeu est probablement en plein écran exclusif" };
  }

  const nom = `${horodatage()}_${etiquette}.png`;
  const chemin = path.join(dossier(), nom);
  fs.writeFileSync(chemin, png);
  return { chemin, raison: null, taille: image.getSize() };
}

/**
 * Raccourcis retenus, dans l'ordre de préférence.
 *
 * Comme pour l'overlay : un raccourci global échoue en silence quand une autre
 * application le détient déjà, ce qui est fréquent avec les superpositions de
 * Discord, GeForce ou Steam. On essaie, et on retient ce qui a été accepté.
 */
const CANDIDATS = ["Control+Shift+S", "Alt+Shift+S", "Control+Alt+S", "Alt+S"];

let raccourciActif = null;

/**
 * Installe le raccourci de capture.
 *
 * @param {(resultat: { chemin: string|null, raison: string|null }) => void} signaler
 *   Appelé après chaque capture, pour en informer le joueur : sans retour, on
 *   ne sait pas si l'on a appuyé sur la bonne touche.
 */
function initCapture(signaler) {
  for (const combinaison of CANDIDATS) {
    const pris = globalShortcut.register(combinaison, () => {
      capturer("apex").then(signaler).catch(() => signaler({ chemin: null, raison: "échec de la capture" }));
    });
    if (pris) {
      raccourciActif = combinaison;
      break;
    }
  }
  return raccourciActif;
}

function lireRaccourciCapture() {
  return raccourciActif;
}

module.exports = { initCapture, capturer, lireRaccourciCapture, dossier };
