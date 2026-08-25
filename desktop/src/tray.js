// Icône dans la zone de notification.
//
// Elle existe pour une raison précise : la détection automatique des parties
// suppose que l'application tourne pendant qu'on joue. Or on ne garde pas une
// fenêtre ouverte pendant une soirée de League. Fermer la fenêtre met donc
// l'application en veille dans la zone de notification plutôt que de l'arrêter.
//
// Le piège à éviter est celui qu'on vient de corriger : une application vivante
// sans rien à l'écran. Ici, l'icône est précisément ce qui rend cet état
// visible — et le premier masquage est annoncé, pour que personne ne croie
// avoir quitté.

const { app, Tray, Menu, nativeImage, Notification } = require("electron");
const path = require("path");
const { textes } = require("./textes");

let tray = null;
let previenuUneFois = false;

/**
 * Crée l'icône et son menu.
 *
 * @param {object} actions
 * @param {() => void} actions.ouvrir   Ramène la fenêtre principale.
 * @param {() => void} actions.quitter  Arrête réellement l'application.
 * @param {() => boolean} actions.overlayActif Lit le réglage de l'overlay.
 * @param {(actif: boolean) => void} actions.setOverlayActif
 * @param {string | (() => string)} actions.langue
 *   La langue du menu. Une fonction plutôt qu'une valeur : l'icône est posée
 *   au démarrage, avant que la fenêtre ait chargé la moindre page, donc avant
 *   qu'on sache quoi que ce soit de la langue choisie.
 * @returns {{ arreter: () => void, rafraichir: () => void }}
 *   `rafraichir` reconstruit le menu, une fois la langue apprise.
 */
function initTray({ ouvrir, quitter, overlayActif, setOverlayActif, basculerOverlay, raccourci,
                   capturer, raccourciCapture, ouvrirCaptures, lireEcran,
                   releveActif, setReleveActif, langue }) {
  // Le menu est le seul écran qui subsiste quand la fenêtre est fermée. Il
  // s'écrivait en français pour tout le monde ; c'est la langue de la personne
  // qui le lit qui décide, comme partout ailleurs.
  //
  // Elle se relit à CHAQUE construction du menu, et non une fois à
  // l'ouverture : l'icône est posée au démarrage, avant que la fenêtre ait
  // chargé la moindre page, donc avant qu'on sache quoi que ce soit de la
  // langue choisie.
  const lireLangue = () => (typeof langue === "function" ? langue() : langue);
  const image = nativeImage.createFromPath(path.join(__dirname, "..", "build", "tray.png"));
  tray = new Tray(image);
  tray.setToolTip("Win or Workout");

  const construireMenu = () => { const T = textes(lireLangue()); return Menu.buildFromTemplate([
    { label: T.trayOuvrir, click: ouvrir },
    { type: "separator" },
    {
      // Un raccourci global peut être capté par une autre application, ou
      // simplement jamais livré si le jeu tourne avec des privilèges plus
      // élevés que les nôtres. Ce menu, lui, répond toujours.
      label: raccourci ? `${T.trayBascule}\t${raccourci}` : T.trayBascule,
      click: basculerOverlay,
    },
    {
      label: T.trayOverlay,
      type: "checkbox",
      checked: overlayActif(),
      click: (item) => {
        setOverlayActif(item.checked);
        // Le menu garde son état d'affichage : on le reconstruit pour qu'il
        // reflète ce qui a réellement été enregistré.
        tray.setContextMenu(construireMenu());
      },
    },
    { type: "separator" },
    /**
     * Capture d'écran, pour calibrer la lecture des chiffres d'Apex.
     *
     * Le raccourci global peut être détenu par Discord ou GeForce, auquel cas
     * il ne fait rien et personne ne sait pourquoi. Ce menu répond toujours :
     * c'est le chemin de secours, et le seul dont on soit sûr.
     */
    ...(capturer ? [{
      label: raccourciCapture ? `${T.trayCapturer}\t${raccourciCapture}` : T.trayCapturer,
      click: capturer,
    }] : []),
    ...(ouvrirCaptures ? [{ label: T.trayDossierCaptures, click: ouvrirCaptures }] : []),
    /**
     * Lecture des chiffres d'Apex, déclenchée à la main.
     *
     * Le résultat s'affiche dans l'overlay : c'est le seul endroit visible
     * quand un jeu tourne, Windows taisant ses notifications à ce moment-là.
     */
    ...(lireEcran ? [{ label: T.trayLireEcran, click: lireEcran }] : []),
    /**
     * La lecture en boucle pendant la partie, qui fait vivre la pastille.
     *
     * Elle capture l'écran toutes les cinq secondes : imperceptible en
     * principe, mais c'est au joueur d'en juger sur sa machine.
     */
    ...(releveActif ? [{
      label: T.trayLirePendant,
      type: "checkbox",
      checked: releveActif(),
      click: (item) => { setReleveActif(item.checked); tray.setContextMenu(construireMenu()); },
    }] : []),
    { type: "separator" },
    { label: T.trayQuitter, click: quitter },
  ]); };

  tray.setContextMenu(construireMenu());
  // Sur Windows, le double-clic sur l'icône est le geste attendu pour rouvrir.
  tray.on("double-click", ouvrir);

  /** Le menu est reconstruit : appelée quand la langue vient d'être apprise. */
  const rafraichir = () => {
    if (tray && !tray.isDestroyed()) tray.setContextMenu(construireMenu());
  };

  const arreter = () => {
    if (tray && !tray.isDestroyed()) tray.destroy();
    tray = null;
  };

  return { arreter, rafraichir };
}

/**
 * Prévient, une seule fois par session, que l'application continue de tourner.
 * Sans ça, fermer la fenêtre donnerait l'impression d'avoir quitté, et on
 * retomberait sur le processus fantôme qu'on cherche justement à éviter.
 */
function signalerVeille(langue) {
  if (previenuUneFois || !Notification.isSupported()) return;
  previenuUneFois = true;
  const T = textes(langue);
  new Notification({
    title: T.veilleTitre,
    body: T.veilleCorps,
    icon: path.join(__dirname, "..", "build", "icon.png"),
  }).show();
}

module.exports = { initTray, signalerVeille };
