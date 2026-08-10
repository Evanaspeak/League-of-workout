// Fenêtre d'overlay affichée par-dessus le jeu.
//
// C'est une fenêtre Electron classique, simplement transparente, sans cadre et
// maintenue au-dessus de tout. Il n'y a AUCUNE injection dans le jeu : on ne
// touche pas à son processus ni à son rendu, donc rien qui puisse inquiéter un
// anti-cheat.
//
// Conséquence de ce choix : l'affichage dépend de la façon dont le jeu occupe
// l'écran.
//   - Fenêtré ou sans bordure          → l'overlay s'affiche.
//   - Plein écran exclusif             → il ne s'affiche pas.
//   - Plein écran avec les « optimisations plein écran » de Windows 10/11 →
//     le jeu tourne en réalité en composité, et l'overlay s'affiche quand même.
//
// Ce dernier cas est fréquent mais dépend de la machine : c'est précisément ce
// que ce module sert à vérifier.

const { BrowserWindow, screen, globalShortcut } = require("electron");
const path = require("path");

/** Marge depuis le bord de l'écran, en pixels. */
const MARGE = 24;
const LARGEUR = 230;
const HAUTEUR = 132;

let fenetre = null;

/**
 * Crée la fenêtre d'overlay. Elle démarre cachée : c'est `afficher()` ou le
 * raccourci clavier qui la montre.
 */
function creerOverlay() {
  const zone = screen.getPrimaryDisplay().workAreaSize;

  fenetre = new BrowserWindow({
    width: LARGEUR,
    height: HAUTEUR,
    x: zone.width - LARGEUR - MARGE,
    y: MARGE,

    // Apparence : pas de cadre, fond transparent, pas d'ombre portée.
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: "#00000000",

    // Comportement : toujours au-dessus, jamais dans la barre des tâches, et
    // surtout jamais focusable — l'overlay ne doit pas voler le clavier au jeu.
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,

    webPreferences: {
      preload: path.join(__dirname, "overlay-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // « screen-saver » est le niveau le plus élevé : c'est celui qui donne la
  // meilleure chance de passer devant un jeu en plein écran.
  fenetre.setAlwaysOnTop(true, "screen-saver");
  fenetre.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Laisse passer tous les clics vers le jeu : l'overlay est purement visuel.
  fenetre.setIgnoreMouseEvents(true, { forward: true });

  fenetre.loadFile(path.join(__dirname, "overlay.html"));

  fenetre.on("closed", () => { fenetre = null; });
  return fenetre;
}

function afficher() {
  if (!fenetre || fenetre.isDestroyed()) creerOverlay();
  // showInactive plutôt que show : la fenêtre apparaît sans prendre le focus,
  // donc sans faire perdre le contrôle du jeu.
  fenetre.showInactive();
  fenetre.setAlwaysOnTop(true, "screen-saver");
}

function masquer() {
  if (fenetre && !fenetre.isDestroyed()) fenetre.hide();
}

function basculer() {
  if (fenetre && !fenetre.isDestroyed() && fenetre.isVisible()) masquer();
  else afficher();
}

/** Pousse un état vers la fenêtre d'overlay (partie en cours, dette, etc.). */
function envoyerEtat(etat) {
  if (fenetre && !fenetre.isDestroyed()) {
    fenetre.webContents.send("overlay:etat", etat);
  }
}

/**
 * Prépare l'overlay et enregistre le raccourci de bascule. Le raccourci est
 * global : il fonctionne même quand le jeu a le focus, ce qui est indispensable
 * pour tester en pleine partie.
 */
function initOverlay({ raccourci = "Control+Shift+O" } = {}) {
  creerOverlay();

  const enregistre = globalShortcut.register(raccourci, basculer);
  if (!enregistre) {
    console.warn(`[LOW] Raccourci ${raccourci} indisponible (déjà pris ?)`);
  }

  return () => {
    globalShortcut.unregister(raccourci);
    if (fenetre && !fenetre.isDestroyed()) fenetre.destroy();
  };
}

module.exports = { initOverlay, afficher, masquer, basculer, envoyerEtat };
