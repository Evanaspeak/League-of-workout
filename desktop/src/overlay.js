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
const { textes } = require("./textes");

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
/** La pastille doit-elle rester hors des captures d'écran ? */
let protege = false;
/**
 * Position posée à la main, en pixels d'écran. Elle l'emporte sur le coin :
 * quatre coins ne suffisent pas, l'interface d'un jeu n'occupe jamais les mêmes
 * zones d'une résolution à l'autre.
 */
let positionLibre = null;
/** Vrai pendant qu'on déplace la pastille : elle accepte alors la souris. */
let enPlacement = false;
/** La question en cours par-dessus le jeu, et de quoi y répondre. */
let questionEnCours = null;
let dernierIdQuestion = 0;
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
 * Silence demandé pour LA partie en cours.
 *
 * Refuser la session à l'écran de chargement veut dire « pas ce soir, pas
 * cette partie » : laisser la pastille à l'écran ferait rester la seule chose
 * qu'on venait d'écarter. Elle se tait donc jusqu'à la partie SUIVANTE — pas
 * pour toujours, ce qui serait le réglage `actif` et se règle ailleurs.
 *
 * L'état vit ici et non dans la page : la page se recharge, la coquille non,
 * et c'est elle qui sait quand une partie commence.
 */
let muet = false;

/**
 * Vrai pendant qu'une question occupe l'écran entier.
 *
 * La question tenait dans la pastille — 230 pixels dans un coin, par-dessus un
 * écran de chargement. Signalé par le propriétaire du produit : « je n'ai pas
 * vu le message ». Une question qu'on ne voit pas ne pose rien ; elle expire,
 * et l'expiration vaut refus.
 *
 * Elle prend donc tout l'écran le temps d'être posée, et la fenêtre reprend sa
 * taille de pastille juste après. Sans ce drapeau, `replacer()` — appelé par
 * les réglages d'un jeu qui démarre — la ramènerait à 230 pixels au milieu de
 * la question.
 */
let questionPleinEcran = false;
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
  /** Chiffres lus à l'écran, pour les jeux qui n'exposent rien. */
  apex: null,
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
  // Une question occupe l'écran : la replacer la rendrait minuscule au pire
  // moment. Elle retrouvera sa place en se refermant.
  if (questionPleinEcran) return;
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

  // Une fenêtre recréée en pleine partie doit retrouver l'exclusion de capture,
  // sinon la lecture se remet à buter dessus sans que rien ne le signale.
  if (protege) fenetre.setContentProtection(true);

  fenetre.loadFile(path.join(__dirname, "overlay.html"));
  // Le contenu se charge de façon asynchrone : l'état doit lui être renvoyé
  // une fois prêt, sinon une fenêtre recréée en pleine partie afficherait
  // « pas de partie » jusqu'au prochain événement.
  fenetre.webContents.on("did-finish-load", () => {
    if (fenetre && !fenetre.isDestroyed()) {
      // Les mots d'abord : sinon la pastille se peint une fois avec ses
      // valeurs par défaut, puis se réécrit sous les yeux du joueur.
      envoyerTextes();
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
  /**
   * Le silence ne vaut que contre l'affichage AUTOMATIQUE.
   *
   * Un raccourci pressé exprès est une demande, et elle passe : sinon on
   * aurait une pastille qu'on ne peut plus rappeler avant la partie suivante.
   *
   * Il n'y a rien à remettre à zéro ici. J'avais ajouté un `muet = false` sur
   * la branche explicite, et le sabotage l'a démenti : aucun test ne le
   * distingue, parce que le garde ci-dessus laisse déjà passer toute demande
   * explicite, et qu'une partie qui commence lève le silence de toute façon.
   * Une ligne qu'on peut retirer sans qu'un test tombe ne tient rien — et elle
   * se relit comme une garantie.
   */
  if (muet && !parLUtilisateur) return;
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

/**
 * Tait la pastille pour la partie en cours, et pour elle seule.
 *
 * Appelée quand on répond « non » à la question de l'écran de chargement.
 * Elle ne touche à aucun réglage : la partie suivante la ramène.
 */
function masquerJusquALaProchainePartie() {
  muet = true;
  masquer();
}

/**
 * Lève le silence sans rien afficher.
 *
 * Sans elle, un refus resterait en vigueur pour toujours le jour où quelqu'un
 * passe le réglage de session sur « lance sans demander » : plus aucune
 * question n'étant posée, plus rien ne lèverait le silence, et la pastille
 * serait éteinte sans que personne ne sache pourquoi. Un jeu qu'on ferme est
 * la fin d'une soirée : c'est le bon moment.
 */
function leverSilence() {
  muet = false;
}

function basculer() {
  if (voulu) masquer();
  else afficher({ parLUtilisateur: true });
}

/**
 * Déclare si une partie tourne. C'est le filet de sécurité de l'affichage :
 * l'overlay n'a rien à faire à l'écran en dehors d'une partie, même si la fin
 * de la précédente n'a jamais été signalée.
 *
 * @param {unknown} valeur
 * @param {string|null} jeu Nom du jeu, tel que la détection le publie. Sans
 *   annotation, TypeScript déduit le type de la valeur par défaut — `null` —
 *   et refuse le seul argument que cette fonction reçoive jamais.
 */
function definirEnPartie(valeur, jeu = null) {
  const avant = enPartie;
  enPartie = Boolean(valeur);
  // Une partie qui commence rend la main à l'affichage automatique : le
  // raccourci reste maître jusque-là, pas au-delà.
  if (enPartie) manuel = false;

  if (enPartie && !avant) {
    /**
     * Le silence n'est PAS levé ici, et c'est une correction.
     *
     * Il l'était, au motif qu'« une partie qui commence lève le silence de la
     * précédente ». C'était faux pour League, et signalé par le propriétaire :
     * la question se pose sur l'ÉCRAN DE CHARGEMENT, donc AVANT que la partie
     * commence. La partie qui démarrait ensuite était donc celle-là même
     * qu'on venait de refuser — elle levait son propre silence, et la pastille
     * revenait quelques secondes après qu'on eut cliqué « non ».
     *
     * Le silence se lève maintenant à la question SUIVANTE, ce qui est
     * exactement ce qui avait été demandé : « jusqu'au prochain écran de
     * chargement ». La question EST cet écran.
     */
    partieEnCoursSec = 0;
    const releve = JEUX_AVEC_RELEVE.has(jeu);
    // Sans relevé, personne ne viendra dire combien de temps s'est écoulé :
    // c'est l'horloge du poste qui compte, depuis maintenant.
    debutSansReleve = releve ? null : Date.now();
    envoyerEtat({ enPartie: true, partieSec: 0, score: null, jeu, releve, apex: null });
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

/**
 * Pose une question par-dessus le jeu, et rend la réponse.
 *
 * C'est la PAGE qui écrit les mots : elle connaît le compte, ses réglages et
 * ses six langues. La coquille n'affiche que ce qu'on lui donne — la règle
 * vaut ici comme ailleurs, et elle s'était déjà fait prendre à parler français
 * à tout le monde.
 *
 * La fenêtre cesse de laisser passer les clics le temps de la question, comme
 * en mode placement. Elle le redevient ensuite : une pastille qui intercepte
 * la souris pendant une partie est pire que pas de pastille.
 *
 * La question se referme d'elle-même au bout du délai, sans réponse. C'est
 * voulu : elle paraît sur l'écran de chargement, et si personne n'a cliqué
 * quand la partie commence, on ne va pas retenir quelqu'un qui joue.
 *
 * Les quatre champs sont annotés : sans ça, TypeScript déduit le type du seul
 * qui porte une valeur par défaut, et refuse les trois autres à l'appel.
 *
 * @param {{ texte?: string, oui?: string, non?: string, delaiMs?: number }} [q]
 * @returns {Promise<boolean|null>} `null` si personne n'a répondu.
 */
function poserQuestion({ texte, oui, non, delaiMs = 45_000 } = {}) {
  if (!fenetre || fenetre.isDestroyed()) creerOverlay();
  // Une question chasse la précédente : deux questions empilées par-dessus un
  // jeu n'ont aucun sens, et la plus ancienne n'intéresse plus personne.
  if (questionEnCours) questionEnCours.repondre(null);

  const id = ++dernierIdQuestion;
  /**
   * Une question posée est un écran de chargement, donc une NOUVELLE partie :
   * c'est ici que le silence d'un refus précédent se lève. Écrit plus haut, il
   * se levait sur la partie qu'on venait de refuser.
   */
  muet = false;
  afficher({ parLUtilisateur: true });
  /**
   * La question prend TOUT l'écran.
   *
   * Dans la pastille, elle faisait 230 pixels dans un coin par-dessus un écran
   * de chargement : on ne la voyait pas, donc on n'y répondait pas, donc elle
   * expirait — et une expiration vaut refus. Autant ne pas la poser.
   *
   * La fenêtre reprend sa taille en se refermant, y compris quand personne
   * n'a répondu : une pastille restée plein écran intercepterait la souris
   * pendant toute la partie, ce qui est bien pire que pas de pastille.
   */
  questionPleinEcran = true;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  fenetre.setBounds({ x: 0, y: 0, width, height });
  fenetre.setIgnoreMouseEvents(false, { forward: true });
  fenetre.setFocusable(true);
  fenetre.webContents.send("overlay:question", { id, texte, oui, non });

  return new Promise((resoudre) => {
    let fini = false;
    const repondre = (valeur) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      questionEnCours = null;
      if (fenetre && !fenetre.isDestroyed()) {
        fenetre.webContents.send("overlay:question", null);
        // La taille se rend AVANT tout le reste : c'est la seule chose dont
        // l'oubli laisserait une fenêtre plein écran par-dessus le jeu.
        questionPleinEcran = false;
        replacer();
        // On ne retire la main qu'en dehors du mode placement : sinon on
        // reprendrait à quelqu'un la pastille qu'il est en train de déplacer.
        if (!enPlacement) {
          fenetre.setIgnoreMouseEvents(true, { forward: true });
          fenetre.setFocusable(false);
        }
        if (!enPartie && !enPlacement && !manuel) masquer();
      }
      resoudre(valeur);
    };
    const minuteur = setTimeout(() => repondre(null), delaiMs);
    questionEnCours = { id, repondre };
  });
}

/** Réponse venue de la fenêtre. Une question inconnue est ignorée. */
function reponseQuestion(id, oui) {
  if (!questionEnCours || questionEnCours.id !== id) return;
  questionEnCours.repondre(Boolean(oui));
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

/**
 * Chiffres relevés à l'écran pour un jeu qui ne se raconte pas.
 *
 * Apex n'expose rien : ces valeurs viennent de la lecture de l'image, pas
 * d'une API. `sur` dit si les modes de lecture se sont accordés — un chiffre
 * incertain s'affiche autrement, plutôt que de se faire passer pour acquis.
 */
function definirReleveApex({ eliminations, degats, sur, attente }) {
  // `attente` porte l'état d'une lecture qui n'a rien donné : « écran noir »,
  // « rien à lire ». La ligne existe alors quand même, avec sa raison — une
  // pastille muette ne dit pas si la boucle tourne.
  if (attente) return envoyerEtat({ apex: { attente } });
  envoyerEtat({ apex: { eliminations, degats, sur: Boolean(sur) } });
}

/**
 * Retire la pastille des captures d'écran, sans la retirer de l'écran.
 *
 * La pastille se pose par défaut en haut à droite — exactement là où Apex
 * dessine son cartouche d'éliminations. Elle recouvrait donc le nombre que la
 * lecture allait chercher : l'outil se cachait sa propre mesure. Windows sait
 * exclure une fenêtre de la capture (`WDA_EXCLUDEFROMCAPTURE`) tout en la
 * laissant visible au joueur ; c'est ce que fait cet appel, et c'est mieux que
 * de déplacer une pastille que le joueur a posée où il la voulait.
 */
function protegerDeLaCapture(valeur) {
  protege = Boolean(valeur);
  if (fenetre && !fenetre.isDestroyed()) fenetre.setContentProtection(protege);
}

/** Dette en cours, poussée par la page qui la calcule. */
function definirDette(dette) {
  envoyerEtat({ dette });
}

/** Minuteur du retrait automatique après un signal de capture. */
let retraitApresCapture = null;

/**
 * Dit à l'écran qu'une capture vient d'être prise.
 *
 * La notification Windows ne suffit pas : dès qu'un jeu tourne, l'Assistant de
 * concentration s'active tout seul — règle « Quand je joue à un jeu », activée
 * par défaut — et supprime les notifications. On appuyait donc sur la touche
 * sans rien voir, ce qui revient à ne pas savoir si le raccourci nous
 * appartient.
 *
 * L'overlay, lui, est à nous et il est déjà au premier plan. Si la pastille
 * est masquée, on la montre le temps du message : deux secondes et demie sur
 * un écran de fin de partie ne dérangent personne, et c'est le seul moment où
 * l'on appuie.
 */
function signalerCapture({ ok, texte }) {
  envoyerEtat({ capture: { ok: Boolean(ok), texte: String(texte || ""), pose: Date.now() } });

  if (retraitApresCapture) {
    clearTimeout(retraitApresCapture);
    retraitApresCapture = null;
  }
  if (voulu) return;

  // Montrée pour le seul message : on ne touche ni à `voulu` ni à `manuel`,
  // sinon la surveillance croirait à un affichage demandé et le maintiendrait.
  if (!fenetre || fenetre.isDestroyed()) creerOverlay();
  fenetre.showInactive();
  fenetre.setAlwaysOnTop(true, "screen-saver");
  retraitApresCapture = setTimeout(() => {
    retraitApresCapture = null;
    if (!voulu && fenetre && !fenetre.isDestroyed()) fenetre.hide();
  }, 2600);
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

/**
 * Pousse un état vers la fenêtre d'overlay (partie en cours, chrono, jeu).
 *
 * Le temps de soirée se recalcule à chaque envoi pour un jeu sans relevé.
 *
 * La fenêtre avance son compteur d'une seconde par seconde, mais le remet à
 * l'heure sur chaque état reçu — c'est ce qui garde League aligné sur l'horloge
 * de la partie. Or `sessionSec` n'était mis à jour que PAR ce relevé : pour
 * Apex il restait à zéro, et le moindre envoi — une capture d'écran, la dette
 * qui bouge — renvoyait le chrono à « --:-- ». Il ne montait jamais plus de
 * quelques secondes.
 */
/**
 * Les mots de la pastille, poussés séparément de l'état.
 *
 * La pastille est la surface la plus vue de l'application de bureau : elle est
 * à l'écran pendant qu'on joue. Elle était écrite en français en dur, dans son
 * HTML. Le texte voyage donc maintenant avec la langue, comme partout ailleurs
 * où l'on sort de React.
 */
let langueOverlay = "en";

function definirLangue(langue) {
  langueOverlay = langue;
  envoyerTextes();
}

function envoyerTextes() {
  if (fenetre && !fenetre.isDestroyed()) {
    fenetre.webContents.send("overlay:textes", textes(langueOverlay));
  }
}

function envoyerEtat(etat) {
  dernierEtat = { ...dernierEtat, ...etat };
  if (debutSansReleve !== null) {
    dernierEtat.sessionSec = cumulSec + Math.round((Date.now() - debutSansReleve) / 1000);
  }
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

/**
 * Rendu pour les tests : le placement est de l'arithmétique pure, et c'est la
 * seule chose de ce module qui puisse rendre la pastille INVISIBLE — posée hors
 * de tout affichage, sans moyen de la récupérer autrement qu'en éditant un
 * fichier de réglages.
 */
const _placement = { positionDuCoin, dansLEcran, LARGEUR, HAUTEUR, MARGE };

module.exports = {
  _placement,
  initOverlay, afficher, masquer, masquerJusquALaProchainePartie, leverSilence, basculer,
  envoyerEtat, definirEnPartie, definirReleve, definirDette, signalerCapture,
  definirReleveApex,
  protegerDeLaCapture,
  definirCoin, coinSuivant, COINS, lireRaccourcis,
  definirPlacement, lirePlacement, appliquerConfig,
  poserQuestion, reponseQuestion,
  definirLangue,
};
