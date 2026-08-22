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
 */
function initTray({ ouvrir, quitter, overlayActif, setOverlayActif, basculerOverlay, raccourci,
                   capturer, raccourciCapture, ouvrirCaptures, lireEcran,
                   releveActif, setReleveActif }) {
  const image = nativeImage.createFromPath(path.join(__dirname, "..", "build", "tray.png"));
  tray = new Tray(image);
  tray.setToolTip("Win or Workout");

  const construireMenu = () => Menu.buildFromTemplate([
    { label: "Ouvrir Win or Workout", click: ouvrir },
    { type: "separator" },
    {
      // Un raccourci global peut être capté par une autre application, ou
      // simplement jamais livré si le jeu tourne avec des privilèges plus
      // élevés que les nôtres. Ce menu, lui, répond toujours.
      label: raccourci
        ? `Afficher / masquer l'overlay\t${raccourci}`
        : "Afficher / masquer l'overlay",
      click: basculerOverlay,
    },
    {
      label: "Overlay en jeu",
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
      label: raccourciCapture
        ? `Capturer l'écran\t${raccourciCapture}`
        : "Capturer l'écran",
      click: capturer,
    }] : []),
    ...(ouvrirCaptures ? [{ label: "Ouvrir le dossier des captures", click: ouvrirCaptures }] : []),
    /**
     * Lecture des chiffres d'Apex, déclenchée à la main.
     *
     * Le résultat s'affiche dans l'overlay : c'est le seul endroit visible
     * quand un jeu tourne, Windows taisant ses notifications à ce moment-là.
     */
    ...(lireEcran ? [{ label: "Lire les chiffres à l'écran", click: lireEcran }] : []),
    /**
     * La lecture en boucle pendant la partie, qui fait vivre la pastille.
     *
     * Elle capture l'écran toutes les cinq secondes : imperceptible en
     * principe, mais c'est au joueur d'en juger sur sa machine.
     */
    ...(releveActif ? [{
      label: "Lire l'écran pendant la partie",
      type: "checkbox",
      checked: releveActif(),
      click: (item) => { setReleveActif(item.checked); tray.setContextMenu(construireMenu()); },
    }] : []),
    { type: "separator" },
    { label: "Quitter", click: quitter },
  ]);

  tray.setContextMenu(construireMenu());
  // Sur Windows, le double-clic sur l'icône est le geste attendu pour rouvrir.
  tray.on("double-click", ouvrir);

  return () => {
    if (tray && !tray.isDestroyed()) tray.destroy();
    tray = null;
  };
}

/**
 * Prévient, une seule fois par session, que l'application continue de tourner.
 * Sans ça, fermer la fenêtre donnerait l'impression d'avoir quitté, et on
 * retomberait sur le processus fantôme qu'on cherche justement à éviter.
 */
function signalerVeille() {
  if (previenuUneFois || !Notification.isSupported()) return;
  previenuUneFois = true;
  new Notification({
    title: "Win or Workout continue en arrière-plan",
    body: "Tes parties restent détectées. Clique sur l'icône près de l'horloge pour rouvrir, ou « Quitter » pour arrêter.",
    icon: path.join(__dirname, "..", "build", "icon.png"),
  }).show();
}

module.exports = { initTray, signalerVeille };
