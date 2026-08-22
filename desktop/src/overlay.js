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

/**
 * Jeux qui exposent une partie en cours à qui sait la lire.
 *
 * League ouvre une API locale pendant la partie : horloge, KDA, champion. Rien
 * de tel chez Apex, Fortnite ou PUBG — et il ne s'agit pas d'un oubli, c'est
 * qu'aucune de ces éditions n'expose quoi que ce soit à un programme tiers.
 *
 * La distinction compte pour l'affichage : une ligne qui ne peut JAMAIS se
 * remplir doit disparaître, pas afficher un tiret. Un tiret se lit comme
 * « en attente », et on attend alors quelque chose qui ne viendra pas.
 */
const JEUX_AVEC_RELEVE = new Set(["League of Legends", "Teamfight Tactics"]);

/** Marge depuis le bord de l'écran, en pixels. */
const MARGE = 24;

/**
 * Coins possibles. En haut à droite, l'overlay recouvre le score et le CS de
 * League : il faut donc pouvoir le déplacer, sans quoi il gêne au lieu d'aider.
 */
const COINS = ["haut-droite", "haut-gauche", "bas-droite", "bas-gauche"];
const LARGEUR = 230;
// Assez haut pour les quatre lignes du bas ET la consigne du mode placement :
// la page est en `overflow: hidden`, ce qui dépasse est coupé sans un mot.
const HAUTEUR = 210;

let fenetre = null;
/**
 * Position posée à la main, en pixels d'écran. Elle l'emporte sur le coin :
 * quatre coins ne suffisent pas, l'interface d'un jeu n'occupe jamais les mêmes
 * zones d'une résolution à l'autre.
 */
let positionLibre = null;
/** Vrai pendant qu'on déplace la pastille : elle accepte alors la souris. */
let enPlacement = false;
/**
 * Ce qu'on veut afficher, indépendamment de ce que Windows accepte de dessiner.
 *
 * Se fier à `isVisible()` désynchronise la bascule : en plein écran exclusif la
 * fenêtre peut être « visible » sans être composée, et le raccourci la cachait
 * alors pour de bon au lieu de la montrer.
 */
let voulu = false;
let surveillance = null;
/** Coin où se pose la pastille. Fourni au démarrage par les réglages. */
let coinActuel = COINS[0];
/**
 * Une partie est-elle réellement en cours ?
 *
 * L'affichage reposait uniquement sur des événements de début et de fin. Il
 * suffit qu'une fin soit manquée — application lancée en cours de partie,
 * hoquet de l'API locale, jeu fermé brutalement — pour que l'overlay reste au
 * premier plan indéfiniment, y compris dans les menus. On garde donc l'état,
 * et la surveillance s'en sert pour rattraper ce qui a été raté.
 */
let enPartie = false;
/**
 * Affichage demandé à la main, par le raccourci clavier.
 *
 * Le retrait automatique hors partie ne doit pas contredire un geste explicite :
 * quelqu'un qui appelle l'overlay depuis le bureau veut le voir, même sans jeu
 * lancé. Seul l'affichage automatique est repris.
 */
let manuel = false;
/**
 * Dernier état poussé. La fenêtre d'overlay peut être recréée après une
 * fermeture, ou chargée alors qu'une partie tourne déjà : sans mémoire, elle
 * repartirait de « pas de partie » et son chrono de zéro.
 */
let dernierEtat = {
  enPartie: false,
  /** Temps joué depuis le début de la soirée, hors menus, en secondes. */
  sessionSec: 0,
  /** Temps de la partie en cours, donné par l'horloge du jeu. */
  partieSec: 0,
  score: null,
  dette: null,
  jeu: null,
  /** Faux quand le jeu n'expose rien : la fenêtre masque alors ce qu'elle ne
   *  pourra pas remplir. */
  releve: false,
};

/**
 * Temps joué cumulé sur les parties terminées.
 *
 * Compter le temps écoulé depuis le lancement reviendrait à facturer les
 * menus, les pauses et les allers-retours aux toilettes. Seule l'horloge
 * interne du jeu compte, et elle s'arrête d'elle-même entre deux parties.
 */
let cumulSec = 0;
/** Dernière durée relevée sur la partie en cours, à verser au cumul à la fin. */
let partieEnCoursSec = 0;
/**
 * Instant de lancement d'un jeu qui ne se raconte pas, ou `null`.
 *
 * Chez Apex, « la partie » au sens de l'overlay commence au lancement du jeu et
 * finit à sa fermeture : rien ne distingue un lobby d'un déploiement. Le temps
 * compté est donc celui du poste, et il inclut les menus — c'est le seul qu'on
 * puisse honnêtement produire, et le libellé le dit.
 */
let debutSansReleve = null;

/**
 * Crée la fenêtre d'overlay. Elle démarre cachée : c'est `afficher()` ou le
 * raccourci clavier qui la montre.
 */
/** Position en pixels du coin demandé, sur l'écran principal. */
function positionDuCoin(coin) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const aDroite = !coin || coin.endsWith("droite");
  const enBas = coin && coin.startsWith("bas");
  return {
    x: aDroite ? width - LARGEUR - MARGE : MARGE,
    y: enBas ? height - HAUTEUR - MARGE : MARGE,
  };
}

/**
 * Ramène une position dans l'écran. Une résolution qui change, un second écran
 * débranché, et la pastille se retrouverait posée hors de tout affichage —
 * invisible, sans moyen de la récupérer autrement qu'en éditant un fichier.
 */
function dansLEcran({ x, y }) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: Math.max(0, Math.min(Math.round(x), width - LARGEUR)),
    y: Math.max(0, Math.min(Math.round(y), height - HAUTEUR)),
  };
}

/** Où la pastille doit se poser : la main du joueur d'abord, le coin ensuite. */
function positionVoulue() {
  return positionLibre ? dansLEcran(positionLibre) : positionDuCoin(coinActuel);
}

/** Remet la fenêtre là où les réglages courants la veulent. */
function replacer() {
  if (!fenetre || fenetre.isDestroyed()) return;
  const { x, y } = positionVoulue();
  fenetre.setBounds({ x, y, width: LARGEUR, height: HAUTEUR });
}

/**
 * Applique les réglages d'un jeu donné.
 *
 * La place libre à l'écran dépend de l'interface du jeu : le coin qui convient
 * à League recouvre la minimap d'un autre. Un réglage unique obligeait à le
 * refaire à chaque changement de jeu — c'est donc au jeu qui démarre de dire
 * où la pastille se pose.
 */
function appliquerConfig({ coin, position } = {}) {
  coinActuel = COINS.includes(coin) ? coin : COINS[0];
  positionLibre = position && typeof position.x === "number" && typeof position.y === "number"
    ? { x: position.x, y: position.y }
    : null;
  replacer();
}

function creerOverlay() {
  const { x, y } = positionVoulue();

  fenetre = new BrowserWindow({
    width: LARGEUR,
    height: HAUTEUR,
    x,
    y,

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
    // Déplaçable, mais hors de portée : la fenêtre ignore la souris tant qu'on
    // n'est pas en mode placement. Sans `movable`, la zone de saisie de la page
    // resterait inerte et il n'y aurait aucune façon de poser la pastille.
    movable: true,
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
  // Le contenu se charge de façon asynchrone : l'état doit lui être renvoyé
  // une fois prêt, sinon une fenêtre recréée en pleine partie afficherait
  // « pas de partie » jusqu'au prochain événement.
  fenetre.webContents.on("did-finish-load", () => {
    if (fenetre && !fenetre.isDestroyed()) {
      fenetre.webContents.send("overlay:etat", dernierEtat);
      fenetre.webContents.send("overlay:placement", enPlacement);
    }
  });

  // La pastille traînée à la souris : on retient où elle atterrit, sans
  // attendre la sortie du mode — un plantage ne doit pas perdre le geste.
  fenetre.on("moved", () => {
    if (!enPlacement || !fenetre || fenetre.isDestroyed()) return;
    const { x, y } = fenetre.getBounds();
    positionLibre = { x, y };
  });

  fenetre.on("closed", () => { fenetre = null; });
  return fenetre;
}

function afficher({ parLUtilisateur = false } = {}) {
  voulu = true;
  manuel = parLUtilisateur;
  if (!fenetre || fenetre.isDestroyed()) creerOverlay();
  // showInactive plutôt que show : la fenêtre apparaît sans prendre le focus,
  // donc sans faire perdre le contrôle du jeu.
  fenetre.showInactive();
  fenetre.setAlwaysOnTop(true, "screen-saver");
}

function masquer() {
  voulu = false;
  manuel = false;
  if (fenetre && !fenetre.isDestroyed()) fenetre.hide();
}

function basculer() {
  if (voulu) masquer();
  else afficher({ parLUtilisateur: true });
}

/**
 * Déclare si une partie tourne. C'est le filet de sécurité de l'affichage :
 * l'overlay n'a rien à faire à l'écran en dehors d'une partie, même si la fin
 * de la précédente n'a jamais été signalée.
 */
function definirEnPartie(valeur, jeu = null) {
  const avant = enPartie;
  enPartie = Boolean(valeur);
  // Une partie qui commence rend la main à l'affichage automatique : le
  // raccourci reste maître jusque-là, pas au-delà.
  if (enPartie) manuel = false;

  if (enPartie && !avant) {
    partieEnCoursSec = 0;
    const releve = JEUX_AVEC_RELEVE.has(jeu);
    // Sans relevé, personne ne viendra dire combien de temps s'est écoulé :
    // c'est l'horloge du poste qui compte, depuis maintenant.
    debutSansReleve = releve ? null : Date.now();
    envoyerEtat({ enPartie: true, partieSec: 0, score: null, jeu, releve });
  } else if (!enPartie && avant) {
    // La partie qui s'achève rejoint le cumul : c'est du temps réellement
    // joué. Ce qui suit — menus, file d'attente, pause — n'y entrera pas.
    //
    // Pour un jeu sans relevé, `partieEnCoursSec` n'a jamais été alimenté :
    // le temps se lit sur l'horloge du poste, sinon la soirée se solderait à
    // zéro et le compteur retomberait à « --:-- » en fermant le jeu.
    if (debutSansReleve !== null) {
      partieEnCoursSec = Math.round((Date.now() - debutSansReleve) / 1000);
      debutSansReleve = null;
    }
    cumulSec += partieEnCoursSec;
    partieEnCoursSec = 0;
    envoyerEtat({
      enPartie: false, partieSec: 0, sessionSec: cumulSec,
      score: null, jeu: null, releve: false,
    });
  }
}

/** Relevé d'une partie en cours : horloge du jeu et score du joueur. */
function definirReleve({ dureeSec, score }) {
  if (typeof dureeSec === "number") partieEnCoursSec = dureeSec;
  envoyerEtat({
    partieSec: partieEnCoursSec,
    sessionSec: cumulSec + partieEnCoursSec,
    ...(score ? { score } : {}),
  });
}

/**
 * Déplace la pastille dans un autre coin. Le choix est celui du joueur : selon
 * le jeu et la résolution, ce n'est pas toujours le même coin qui est libre.
 */
function definirCoin(coin) {
  coinActuel = COINS.includes(coin) ? coin : COINS[0];
  // Un coin choisi annule le placement à la main : garder les deux reviendrait
  // à ignorer le clic qu'on vient de recevoir.
  positionLibre = null;
  replacer();
  return coinActuel;
}

/**
 * Entre ou sort du mode placement.
 *
 * En mode placement la pastille cesse de laisser passer les clics et accepte le
 * focus : c'est la seule façon de l'attraper. Elle s'affiche aussi, même hors
 * partie — on ne va pas demander de lancer une partie pour la déplacer — et la
 * surveillance ne la retire pas tant qu'on y est.
 */
function definirPlacement(actif) {
  enPlacement = Boolean(actif);
  if (!fenetre || fenetre.isDestroyed()) creerOverlay();

  fenetre.setIgnoreMouseEvents(!enPlacement, { forward: true });
  fenetre.setFocusable(enPlacement);
  fenetre.webContents.send("overlay:placement", enPlacement);

  if (enPlacement) {
    afficher({ parLUtilisateur: true });
  } else {
    const { x, y } = fenetre.getBounds();
    positionLibre = { x, y };
    // Hors partie, la pastille n'a plus de raison de rester à l'écran une fois
    // posée : c'est en jeu qu'elle sert.
    if (!enPartie) masquer();
  }

  return lirePlacement();
}

/** État du placement, tel que les réglages doivent l'afficher. */
function lirePlacement() {
  return {
    placement: enPlacement,
    position: positionLibre,
    /** Vrai quand la pastille a été posée à la main : le coin ne décide plus. */
    libre: positionLibre !== null,
  };
}

/** Passe au coin suivant : c'est ce que déclenche le raccourci clavier. */
function coinSuivant() {
  return definirCoin(COINS[(COINS.indexOf(coinActuel) + 1) % COINS.length]);
}

/** Dette en cours, poussée par la page qui la calcule. */
function definirDette(dette) {
  envoyerEtat({ dette });
}

/**
 * Deux corrections, à intervalle régulier.
 *
 * Un jeu en plein écran exclusif peut faire disparaître l'overlay : on le
 * remontre dès que Windows le laisse à nouveau exister — au retour sur le
 * bureau, ou en passant le jeu en sans bordure. La remise au premier plan n'a
 * lieu que si la fenêtre a réellement été masquée : la réaffirmer pendant que
 * le jeu tient l'écran ne ferait que provoquer une alternance visible.
 *
 * À l'inverse, un overlay resté affiché sans partie est retiré. C'est ce qui
 * manquait : un seul événement de fin manqué le laissait au premier plan pour
 * le reste de la soirée.
 */
function surveiller() {
  if (surveillance) return;
  surveillance = setInterval(() => {
    if (!fenetre || fenetre.isDestroyed()) return;

    if (voulu && !manuel && !enPartie && !enPlacement) {
      // Affiché alors que plus rien ne tourne : on n'attend pas un événement
      // qui ne viendra peut-être jamais.
      masquer();
      return;
    }
    if (!voulu) return;
    if (!fenetre.isVisible()) {
      fenetre.showInactive();
      fenetre.setAlwaysOnTop(true, "screen-saver");
    }
  }, 2000);
}

/** Pousse un état vers la fenêtre d'overlay (partie en cours, chrono, jeu). */
function envoyerEtat(etat) {
  dernierEtat = { ...dernierEtat, ...etat };
  if (fenetre && !fenetre.isDestroyed()) {
    fenetre.webContents.send("overlay:etat", dernierEtat);
  }
}

/**
 * Prépare l'overlay et enregistre le raccourci de bascule. Le raccourci est
 * global : il fonctionne même quand le jeu a le focus, ce qui est indispensable
 * pour tester en pleine partie.
 */
/**
 * Raccourcis retenus, dans l'ordre de préférence.
 *
 * Un raccourci global échoue silencieusement quand une autre application le
 * détient déjà — c'est fréquent avec les superpositions de Discord, GeForce ou
 * Steam. On essaie donc plusieurs combinaisons, et on retient celle qui a
 * réellement été acceptée pour pouvoir l'afficher au joueur.
 */
const CANDIDATS_BASCULE = ["Control+Shift+O", "Alt+Shift+O", "Control+Alt+O", "Alt+O"];
const CANDIDATS_COIN = ["Control+Shift+P", "Alt+Shift+P", "Control+Alt+P", "Alt+P"];

/** Raccourcis effectivement enregistrés, ou null si aucun n'a pu l'être. */
let raccourcisActifs = { bascule: null, coin: null };

function enregistrerPremierLibre(candidats, action) {
  for (const combinaison of candidats) {
    // isRegistered ne voit que nos propres enregistrements : seul le retour de
    // register() dit si le système a accepté.
    if (globalShortcut.register(combinaison, action)) return combinaison;
  }
  return null;
}

function initOverlay({ coin, position } = {}) {
  if (coin) coinActuel = COINS.includes(coin) ? coin : COINS[0];
  if (position && typeof position.x === "number" && typeof position.y === "number") {
    positionLibre = { x: position.x, y: position.y };
  }
  creerOverlay();
  surveiller();

  raccourcisActifs = {
    bascule: enregistrerPremierLibre(CANDIDATS_BASCULE, basculer),
    // Déplacer la pastille sans quitter la partie : c'est en jeu qu'on
    // s'aperçoit qu'elle tombe sur le score.
    coin: enregistrerPremierLibre(CANDIDATS_COIN, coinSuivant),
  };

  if (!raccourcisActifs.bascule) {
    console.warn("[WOW] Aucun raccourci d'affichage disponible — tous déjà pris.");
  }

  return () => {
    globalShortcut.unregisterAll();
    raccourcisActifs = { bascule: null, coin: null };
    if (surveillance) { clearInterval(surveillance); surveillance = null; }
    if (fenetre && !fenetre.isDestroyed()) fenetre.destroy();
  };
}

/** Ce que le joueur doit taper — ou l'aveu qu'aucune combinaison n'est libre. */
function lireRaccourcis() {
  return raccourcisActifs;
}

module.exports = {
  initOverlay, afficher, masquer, basculer,
  envoyerEtat, definirEnPartie, definirReleve, definirDette,
  definirCoin, coinSuivant, COINS, lireRaccourcis,
  definirPlacement, lirePlacement, appliquerConfig,
};
