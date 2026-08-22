// Processus principal de l'app desktop Win or Workout.
//
// Flux d'authentification :
//   1. Electron charge la page de login.
//   2. L'utilisateur clique "Se connecter avec Google/Discord".
//   3. Electron intercepte la redirection OAuth → ouvre Chrome à la place.
//   4. Chrome gère l'OAuth normalement (pas de restriction navigateur).
//   5. Après succès, le dashboard Chrome envoie le JWT à notre serveur local
//      sur le port 3099 via un fetch CORS.
//   6. Electron reçoit le JWT, le pose comme cookie, charge le dashboard.

const {
  app, BrowserWindow, Menu, Notification, shell, ipcMain, session: electronSession,
} = require("electron");
const path = require("path");
const http = require("http");
const { startLiveClientWatcher } = require("./liveclient");
const overlay = require("./overlay");
const { initTray, signalerVeille } = require("./tray");
const { surveillerJeux, jeuxDetectables } = require("./jeuxProcessus");
const { initCapture, capturer, lireRaccourciCapture, dossier: dossierCaptures } = require("./capture");
const { surveillerClient } = require("./lcu");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
// `crypto` global d'Electron est celui du navigateur : ni randomBytes, ni
// timingSafeEqual. C'est bien le module Node qu'il faut ici.
const crypto = require("crypto");

// Désactive les Client Hints (Sec-CH-UA) qui trahissent Electron auprès de
// Google OAuth même quand le user-agent est spoofé en Chrome standard.
app.commandLine.appendSwitch("disable-features", "UserAgentClientHint");

const BACKEND_URL = process.env.LOW_BACKEND_URL || "https://winorworkout.com";
const AUTH_PORT = 3099;

/**
 * Connexion en cours : l'aléa que nous avons émis, et jusqu'à quand il vaut.
 *
 * Sans lui, le canal local acceptait n'importe quel jeton venu de n'importe où.
 * Une navigation de premier niveau depuis une page web quelconque suffisait à
 * poser la session d'un inconnu dans l'application — et aucune protection du
 * navigateur ne s'y oppose : CORS ne s'applique pas aux navigations, Private
 * Network Access ne les couvre pas, le contenu mixte autorise 127.0.0.1, et
 * SameSite est hors sujet puisque le jeton voyage dans l'adresse.
 *
 * Les clients comparables (Discord, Slack, Spotify) lient leur transfert à un
 * secret que le client a lui-même émis. C'est ce qui manquait.
 */
let attenteAuth = null; // { nonce, expire }
// Cinq minutes ne suffisaient pas : choisir un compte, taper un mot de passe et
// passer une double authentification dépasse couramment ce délai, et l'aléa
// expirait pendant que le joueur s'exécutait — le retour se faisait alors
// refuser sans que rien ne l'explique.
const ATTENTE_MS = 15 * 60 * 1000;
let minuterieAttente = null;

function ouvrirAttenteAuth() {
  // Deux chemins mènent ici — le bouton de la page et l'interception de
  // navigation — et ils peuvent se déclencher coup sur coup pour une SEULE
  // intention de connexion. Chacun forgeait son aléa et écrasait l'autre : le
  // premier retour se faisait alors refuser, et il fallait tout recommencer.
  // Tant que l'attente en cours vaut encore, c'est elle qui sert.
  if (attenteAuth && Date.now() < attenteAuth.expire) return attenteAuth.nonce;
  attenteAuth = {
    nonce: crypto.randomBytes(32).toString("base64url"),
    expire: Date.now() + ATTENTE_MS,
  };
  // Une attente sans fin n'est pas une attente : passé le délai, on le dit.
  if (minuterieAttente) clearTimeout(minuterieAttente);
  minuterieAttente = setTimeout(abandonnerAttente, ATTENTE_MS);
  return attenteAuth.nonce;
}

/** Le délai est écoulé : on rend la main plutôt que de tourner indéfiniment. */
function abandonnerAttente() {
  attenteAuth = null;
  minuterieAttente = null;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // Ne rien faire si la connexion a fini par aboutir et qu'on est ailleurs.
  if (!mainWindow.webContents.getURL().startsWith("data:text/html")) return;
  mainWindow.loadURL(ATTENTE_EXPIREE_HTML);
}

/** Vrai si cet aléa est bien celui que nous attendons, et qu'il vaut encore. */
function nonceValide(recu) {
  if (!attenteAuth || Date.now() > attenteAuth.expire) return false;
  if (typeof recu !== "string" || recu.length !== attenteAuth.nonce.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recu), Buffer.from(attenteAuth.nonce));
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Noms de base du cookie de session : préfixé en HTTPS, nu en local. */
const NOMS_SESSION = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * Pose le jeton de session, après avoir fait place nette.
 *
 * Au-delà d'environ 4 ko, Auth.js découpe son cookie en morceaux numérotés
 * (`.0`, `.1`, …) et, à la lecture, CONCATÈNE tout ce qui commence par le nom
 * de base. On n'écrivait ici qu'un cookie entier, sans retirer les morceaux
 * d'une session précédente : les restes se collaient au nouveau jeton et le
 * rendaient illisible. Le transfert réussissait, l'application se croyait
 * connectée, et le site la renvoyait au vestiaire sans que rien n'explique
 * pourquoi. Le site sait relire ces morceaux — c'est donc un cas qui arrive.
 */
async function poserCookieSession(ses, jwt) {
  const existants = await ses.cookies.get({ url: BACKEND_URL }).catch(() => []);
  for (const c of existants) {
    if (!NOMS_SESSION.some((n) => c.name === n || c.name.startsWith(`${n}.`))) continue;
    await ses.cookies.remove(BACKEND_URL, c.name).catch(() => {});
  }
  await ses.cookies.set({
    url: BACKEND_URL,
    name: "__Secure-authjs.session-token",
    value: jwt,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    // Trente jours : le cookie doit survivre à une fermeture de l'application.
    expirationDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });
}

/**
 * Barre de titre peinte par l'application.
 *
 * Windows dessinait la sienne : une bande claire, avec le nom du programme et
 * un menu « File / Edit / View » dont rien ne sert ici. Elle jurait avec le
 * reste, qui est sombre. `titleBarOverlay` garde les vrais boutons système —
 * réduire, agrandir, fermer, avec leur comportement et leurs zones de clic
 * exactes — et nous laisse la couleur. La hauteur est celle de la barre de
 * navigation du site (h-14, soit 56 px), pour que les deux se superposent
 * pile.
 *
 * Réservé à Windows : ailleurs, l'option est ignorée ou refusée.
 */
const BARRE_DE_TITRE = process.platform === "win32"
  ? {
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#0C0E11", symbolColor: "#ECEFF4", height: 56 },
  }
  : {};

/**
 * Bande à saisir pour déplacer la fenêtre.
 *
 * Sans barre de titre native, plus rien ne permet de bouger la fenêtre à la
 * souris : c'est à la page de désigner la zone. Les pages du site le font par
 * leur barre de navigation ; celles servies d'ici ont besoin de cette bande.
 */
const BANDE_DEPLACEMENT =
  '<div style="position:fixed;top:0;left:0;right:0;height:56px;'
  + '-webkit-app-region:drag"></div>';

let mainWindow = null;
/** Vrai quand c'est bien nous qui écoutons le port de connexion. */
let canalPret = false;
let stopWatcher = null;
let stopOverlay = null;
let stopTray = null;
let stopJeux = null;
let stopClient = null;
/**
 * Ce que le lanceur League nous a appris de la partie à venir : type de file et
 * rôle attribué. L'API de partie ne les donne pas, et ils manquaient donc à
 * l'enregistrement — le rôle était deviné, la file ignorée.
 */
let contextePartie = { file: null, role: null };
/** Vrai seulement si l'icône existe réellement pour rouvrir la fenêtre. */
let trayPret = false;
/** Vrai à partir du moment où l'on quitte pour de bon. */
let onQuitte = false;
/** Garde-fou : le nettoyage de fin ne doit s'exécuter qu'une fois. */
let nettoyageLance = false;

// ── Page d'attente (affichée dans Electron pendant que Chrome gère l'OAuth) ─

const WAITING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Win or Workout</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0C0E11; color: #FFB454; font-family: 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100vh; gap: 16px; }
  h2 { font-size: 20px; letter-spacing: .06em; }
  p  { color: rgba(236,239,244,.5); font-size: 14px; }
  .dots span { animation: blink 1.4s infinite; }
  .dots span:nth-child(2) { animation-delay: .2s; }
  .dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes blink { 0%,80%,100%{opacity:.15} 40%{opacity:1} }
  button { font: inherit; font-size: 13px; padding: 9px 18px; margin: 0 5px;
    border-radius: 6px; cursor: pointer; border: 1px solid #FFB454;
    background: rgba(255,180,84,.12); color: #FFB454; }
  button.discret { border-color: rgba(236,239,244,.2); background: transparent;
    color: rgba(236,239,244,.55); }
</style></head>
<body>
  ${BANDE_DEPLACEMENT}
  <h2>
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
         style="vertical-align:-3px;margin-right:8px">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2"></rect>
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"></path>
    </svg>Authentification en cours <span class="dots"><span>.</span><span>.</span><span>.</span></span></h2>
  <p>Terminez la connexion dans votre navigateur web.</p>
  <p style="font-size:12px;margin-top:8px;color:rgba(236,239,244,.3)">
    Cette fenêtre se met à jour automatiquement une fois connecté.
  </p>
  <!-- Sans cette porte de sortie, le moindre grain de sable — onglet fermé,
       mauvais navigateur par défaut, retour perdu en route — laissait la
       fenêtre tourner indéfiniment, sans rien à faire d'autre que quitter. -->
  <div id="secours" style="display:none;margin-top:26px;text-align:center">
    <p style="font-size:12px;color:rgba(236,239,244,.4);margin-bottom:12px">Rien ne se passe ?</p>
    <button onclick="window.electronLOL &amp;&amp; window.electronLOL.openGoogleLogin()">Rouvrir le navigateur</button>
    <button class="discret" onclick="window.electronLOL &amp;&amp; window.electronLOL.retourConnexion()">Revenir à la connexion</button>
  </div>
  <script>setTimeout(function(){document.getElementById('secours').style.display='block'},20000)</script>
</body></html>`)}`;

// Le canal de connexion est un port unique sur la machine : si une autre
// instance — ou l'ancienne application — le détient déjà, c'est elle qui reçoit
// la session. La fenêtre attendait alors indéfiniment une connexion partie
// ailleurs, sans rien afficher. Le dire est le minimum.
const ERREUR_PORT_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Win or Workout</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0C0E11; color: #ECEFF4; font-family: 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100vh; gap: 14px; text-align: center; padding: 32px; }
  h2 { font-size: 19px; letter-spacing: .06em; color: #FF5A47; }
  p  { color: rgba(236,239,244,.55); font-size: 14px; max-width: 460px; line-height: 1.65; }
</style></head>
<body>
  ${BANDE_DEPLACEMENT}
  <h2>CONNEXION IMPOSSIBLE</h2>
  <p>Une autre application Win or Workout est déjà ouverte sur cet ordinateur :
     probablement une ancienne version.</p>
  <p style="color:rgba(236,239,244,.35);font-size:13px">
     Fermez-la complètement, puis relancez celle-ci. Sans cela, c'est elle qui
     reçoit la connexion.</p>
</body></html>`)}`;

// Le délai d'attente est écoulé. Mieux vaut une fin nette, avec de quoi
// recommencer, qu'une animation qui tourne pour l'éternité.
const ATTENTE_EXPIREE_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Win or Workout</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0C0E11; color: #ECEFF4; font-family: 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100vh; gap: 14px; text-align: center; padding: 32px; }
  h2 { font-size: 19px; letter-spacing: .06em; color: #FFB454; }
  p  { color: rgba(236,239,244,.55); font-size: 14px; max-width: 460px; line-height: 1.65; }
  button { font: inherit; font-size: 13px; padding: 9px 18px; margin: 14px 5px 0;
    border-radius: 6px; cursor: pointer; border: 1px solid #FFB454;
    background: rgba(255,180,84,.12); color: #FFB454; }
  button.discret { border-color: rgba(236,239,244,.2); background: transparent;
    color: rgba(236,239,244,.55); }
</style></head>
<body>
  ${BANDE_DEPLACEMENT}
  <h2>CONNEXION NON TERMINÉE</h2>
  <p>Le navigateur n'a pas rendu la connexion à l'application. Soit elle n'a pas
     été menée à son terme, soit le retour s'est perdu en chemin.</p>
  <div>
    <button onclick="window.electronLOL &amp;&amp; window.electronLOL.openGoogleLogin()">Réessayer</button>
    <button class="discret" onclick="window.electronLOL &amp;&amp; window.electronLOL.retourConnexion()">Autre méthode</button>
  </div>
</body></html>`)}`;

// ── Serveur local d'auth (port 3099) ────────────────────────────────────────
// Chrome (après OAuth) poste le JWT ici pour qu'Electron puisse l'utiliser.

/**
 * Le canal doit répondre sur les DEUX boucles locales.
 *
 * On n'écoutait que sur 127.0.0.1 pendant que la page web navigue vers
 * `localhost`. Or Windows résout `localhost` vers ::1 avant 127.0.0.1, et un
 * navigateur qui tombe sur une pile muette n'a pas toujours de quoi se
 * rabattre : le transfert échouait alors sans un mot, et l'application
 * attendait indéfiniment.
 *
 * Deux écoutes séparées plutôt qu'une écoute sur `::` : cette dernière aurait
 * accepté des connexions venues du réseau local, sur un canal qui distribue un
 * jeton de session.
 */
const ADRESSES_BOUCLE = ["127.0.0.1", "::1"];

function startAuthSignalServer() {
  const gererRequete = (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", BACKEND_URL);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Private-Network", "true");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // GET /set-session?t=JWT — navigation-based handoff from Chrome (bypasses PNA/mixed-content)
    // Chemin comparé exactement : `startsWith` laissait passer /set-sessionXYZ.
    const chemin = req.url ? new URL(req.url, `http://127.0.0.1:${AUTH_PORT}`).pathname : "";
    if (req.method === "GET" && chemin === "/set-session") {
      (async () => {
        try {
          const urlObj = new URL(req.url, `http://127.0.0.1:${AUTH_PORT}`);
          // L'aléa d'abord, le jeton ensuite : un appelant qui n'a pas ouvert la
          // connexion n'apprend rien de la forme attendue de la requête.
          if (!nonceValide(urlObj.searchParams.get("n"))) {
            res.writeHead(403, { "Content-Type": "text/plain" });
            res.end("nonce invalide");
            return;
          }
          const jwt = urlObj.searchParams.get("t");
          if (!jwt) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("jeton manquant");
            return;
          }
          attenteAuth = null; // usage unique
          if (minuterieAttente) { clearTimeout(minuterieAttente); minuterieAttente = null; }

          const ses = mainWindow
            ? mainWindow.webContents.session
            : electronSession.defaultSession;

          await poserCookieSession(ses, jwt);

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(`${BACKEND_URL}/dashboard`);
          }

          // Redirect Chrome to desktop-complete which clears Chrome's session and
          // shows a "connection transferred" message — prevents DesktopAuthHandler loop.
          res.writeHead(302, { Location: `${BACKEND_URL}/api/auth/desktop-complete` });
          res.end();
        } catch (err) {
          // Le message d'erreur reste au journal : le renvoyer décrivait le
          // fonctionnement interne du canal à qui frappait à la porte.
          console.error("canal auth (GET)", err);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("erreur interne");
        }
      })();
      return;
    }

    if (req.method === "POST" && chemin === "/set-session") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", async () => {
        try {
          let recu;
          try {
            recu = JSON.parse(body);
          } catch {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("corps illisible");
            return;
          }
          const { jwt, nonce } = recu ?? {};
          if (!nonceValide(nonce)) {
            res.writeHead(403);
            res.end("nonce invalide");
            return;
          }
          // `cookies.set` rejette une valeur absente, ce qui finissait en 500.
          if (typeof jwt !== "string" || jwt === "") {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("jeton manquant");
            return;
          }
          attenteAuth = null; // usage unique
          if (minuterieAttente) { clearTimeout(minuterieAttente); minuterieAttente = null; }
          const ses = mainWindow
            ? mainWindow.webContents.session
            : electronSession.defaultSession;

          await poserCookieSession(ses, jwt);

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(`${BACKEND_URL}/dashboard`);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error("canal auth (POST)", err);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("erreur interne");
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  };

  // Une écoute par pile, servant le même traitement. Qu'une pile manque sur un
  // poste donné n'est pas une panne ; qu'elle soit OCCUPÉE en est une, car
  // c'est alors une autre instance qui recevra le retour de connexion sur cette
  // adresse-là. On attend donc que les deux tentatives aient répondu avant de
  // déclarer le canal ouvert.
  let restantes = ADRESSES_BOUCLE.length;
  let ouvertes = 0;
  let occupe = false;

  const conclure = () => {
    if (restantes > 0) return;
    canalPret = ouvertes > 0 && !occupe;
    if (occupe) {
      console.warn(`[WOW] Port ${AUTH_PORT} déjà pris — une autre instance détient le canal.`);
    } else if (ouvertes === 0) {
      console.warn("[WOW] Aucune boucle locale n'écoute : le transfert de session échouera.");
    }
  };

  for (const adresse of ADRESSES_BOUCLE) {
    const serveur = http.createServer(gererRequete);
    serveur.on("error", (err) => {
      if (err.code === "EADDRINUSE") occupe = true;
      else console.warn(`[WOW] Écoute ${adresse} indisponible :`, err.code);
      restantes -= 1;
      conclure();
    });
    serveur.listen(AUTH_PORT, adresse, () => {
      ouvertes += 1;
      restantes -= 1;
      conclure();
    });
  }
}

// ── Réglages propres à la machine ───────────────────────────────────────────
// L'overlay dépend du mode d'affichage du jeu et de la carte graphique, pas du
// joueur : le réglage vit donc sur le poste, pas dans le compte.

function cheminReglages() {
  return path.join(app.getPath("userData"), "reglages.json");
}

function lireReglages() {
  try {
    return JSON.parse(fs.readFileSync(cheminReglages(), "utf8"));
  } catch {
    return {};
  }
}

function ecrireReglage(cle, valeur) {
  const reglages = lireReglages();
  reglages[cle] = valeur;
  try {
    fs.writeFileSync(cheminReglages(), JSON.stringify(reglages, null, 2));
  } catch (err) {
    console.warn("[WOW] Réglage non enregistré :", err?.message ?? err);
  }
}

// ── Overlay : un réglage par jeu ────────────────────────────────────────────
//
// La place libre à l'écran dépend de l'interface du jeu. Le coin qui convient à
// League recouvre la minimap ailleurs, et quelqu'un peut vouloir la pastille sur
// un jeu et pas sur un autre. Un réglage unique obligeait à tout refaire à
// chaque changement de jeu.
//
// L'entrée « defaut » sert de repli : c'est elle qui reçoit l'ancien réglage
// global, et elle s'applique à tout jeu qu'on n'a jamais réglé.

const JEU_DEFAUT = "defaut";

/** Réglage d'overlay tel qu'il vaut avant toute intervention. */
function overlayNeutre() {
  return { actif: true, coin: overlay.COINS[0], position: null };
}

/**
 * Table des réglages, reprise de l'ancien format si besoin.
 *
 * Les versions précédentes stockaient `overlay`, `overlayCoin` et
 * `overlayPosition` à plat. Les ignorer aurait remis tout le monde au coin par
 * défaut sans prévenir : ils deviennent donc le défaut de tous les jeux.
 */
function overlayTable() {
  const reglages = lireReglages();
  const table = reglages.overlayJeux && typeof reglages.overlayJeux === "object"
    ? { ...reglages.overlayJeux }
    : {};
  if (!table[JEU_DEFAUT]) {
    table[JEU_DEFAUT] = {
      actif: reglages.overlay !== false,
      coin: overlay.COINS.includes(reglages.overlayCoin) ? reglages.overlayCoin : overlay.COINS[0],
      position: reglages.overlayPosition ?? null,
    };
  }
  return table;
}

/** Réglage d'un jeu, complété par le défaut pour ce qu'il ne dit pas. */
function overlayDuJeu(jeu) {
  const table = overlayTable();
  const defaut = { ...overlayNeutre(), ...table[JEU_DEFAUT] };
  const propre = jeu && table[jeu] ? table[jeu] : {};
  return { ...defaut, ...propre };
}

function ecrireOverlayJeu(jeu, patch) {
  const table = overlayTable();
  const cle = jeu || JEU_DEFAUT;
  table[cle] = { ...overlayDuJeu(cle), ...patch };
  ecrireReglage("overlayJeux", table);
  return table[cle];
}

/**
 * Jeux qu'on peut régler : ceux dont on sait détecter le lancement. Proposer
 * un réglage pour un jeu qu'on ne verra jamais démarrer serait un bouton mort.
 */
function jeuxReglables() {
  return jeuxDetectables();
}

/** Le jeu dont la pastille suit les réglages en ce moment. */
let jeuCourant = null;

/** Activé par défaut : il fonctionne en sans bordure, le mode le plus courant. */
function overlayAutorise(jeu = jeuCourant) {
  return overlayDuJeu(jeu).actif !== false;
}

/**
 * Argument passé à l'application quand Windows la lance à l'ouverture de
 * session. Il sert à démarrer repliée : voir sa fenêtre surgir à chaque
 * allumage serait insupportable, alors qu'on veut juste que la détection des
 * parties soit déjà en place le moment venu.
 */
const ARG_DEMARRAGE = "--au-demarrage";
const lanceAuDemarrage = process.argv.includes(ARG_DEMARRAGE);

/** Windows fait foi : la valeur vit dans son registre, pas chez nous. */
function demarrageAutoActif() {
  if (!app.isPackaged) return false;
  return app.getLoginItemSettings().openAtLogin;
}

function setDemarrageAuto(actif) {
  if (!app.isPackaged) return false;
  app.setLoginItemSettings({
    openAtLogin: Boolean(actif),
    path: process.execPath,
    args: [ARG_DEMARRAGE],
  });
  return demarrageAutoActif();
}

/** Jeux dont on surveille le lancement. Vide = surveillance au repos. */
function jeuxSurveilles() {
  const liste = lireReglages().jeuxSurveilles;
  return Array.isArray(liste) ? liste : [];
}

/**
 * Ce que le lancement d'un jeu surveillé déclenche. Tout est facultatif :
 * quelqu'un peut vouloir l'overlay sans que la fenêtre lui saute au visage.
 */
function actionsDetection() {
  const a = lireReglages().actionsDetection ?? {};
  return {
    session: a.session !== false,
    overlay: a.overlay !== false,
    fenetre: Boolean(a.fenetre),
  };
}

ipcMain.handle("detection:lire", () => ({
  disponible: jeuxDetectables(),
  surveilles: jeuxSurveilles(),
  actions: actionsDetection(),
}));

ipcMain.handle("detection:ecrire", (_e, config) => {
  if (Array.isArray(config?.surveilles)) {
    // On ne garde que des jeux réellement détectables : une valeur inventée
    // resterait cochée sans jamais rien déclencher.
    const connus = new Set(jeuxDetectables());
    ecrireReglage("jeuxSurveilles", config.surveilles.filter((j) => connus.has(j)));
  }
  if (config?.actions) {
    ecrireReglage("actionsDetection", {
      session: Boolean(config.actions.session),
      overlay: Boolean(config.actions.overlay),
      fenetre: Boolean(config.actions.fenetre),
    });
  }
  return {
    disponible: jeuxDetectables(),
    surveilles: jeuxSurveilles(),
    actions: actionsDetection(),
  };
});

ipcMain.handle("demarrage:lire", () => ({
  actif: demarrageAutoActif(),
  disponible: app.isPackaged,
}));
ipcMain.handle("demarrage:ecrire", (_e, actif) => ({
  actif: setDemarrageAuto(actif),
  disponible: app.isPackaged,
}));

ipcMain.on("overlay:dette", (_e, dette) => overlay.definirDette(dette));

/** Tout ce que les réglages affichent de l'overlay, en une seule réponse. */
function etatOverlay(jeu = jeuCourant) {
  const config = overlayDuJeu(jeu);
  return {
    jeu: jeu ?? null,
    actif: config.actif,
    coin: config.coin,
    coins: overlay.COINS,
    position: config.position,
    libre: config.position !== null,
    raccourcis: { ...overlay.lireRaccourcis(), capture: lireRaccourciCapture() },
    placement: overlay.lirePlacement().placement,
  };
}

/** Réglages de tous les jeux d'un coup : c'est ce que la page affiche. */
ipcMain.handle("overlay:jeux-lire", () => ({
  jeux: jeuxReglables(),
  coins: overlay.COINS,
  raccourcis: { ...overlay.lireRaccourcis(), capture: lireRaccourciCapture() },
  placement: overlay.lirePlacement().placement,
  config: Object.fromEntries(jeuxReglables().map((j) => [j, overlayDuJeu(j)])),
}));

ipcMain.handle("overlay:jeu-ecrire", (_e, { jeu, ...patch } = {}) => {
  const config = ecrireOverlayJeu(jeu, patch);
  // Le jeu en cours voit le changement tout de suite : c'est souvent en jouant
  // qu'on s'aperçoit que la pastille tombe au mauvais endroit.
  if (jeu === jeuCourant) {
    overlay.appliquerConfig(config);
    if (!config.actif) overlay.masquer();
  }
  return {
    jeux: jeuxReglables(),
    coins: overlay.COINS,
    raccourcis: { ...overlay.lireRaccourcis(), capture: lireRaccourciCapture() },
    placement: overlay.lirePlacement().placement,
    config: Object.fromEntries(jeuxReglables().map((j) => [j, overlayDuJeu(j)])),
  };
});

// ── Anciens canaux, gardés pour les pages servies à une app plus ancienne ──
ipcMain.handle("overlay:coin-lire", () => etatOverlay());
ipcMain.handle("overlay:coin-ecrire", (_e, coin) => {
  const pose = overlay.definirCoin(coin);
  // Choisir un coin efface la position libre : les deux se contrediraient, et
  // c'est le dernier geste qui fait foi.
  ecrireOverlayJeu(jeuCourant, { coin: pose, position: null });
  return etatOverlay();
});

ipcMain.handle("overlay:lire", () => overlayAutorise());
ipcMain.handle("overlay:ecrire", (_e, actif) => {
  ecrireOverlayJeu(jeuCourant, { actif: Boolean(actif) });
  if (!actif) overlay.masquer();
  return overlayAutorise();
});

// Placement libre : la pastille devient attrapable à la souris, et la position
// obtenue est retenue pour le jeu qu'on règle. Quatre coins ne suffisent pas —
// selon la résolution et l'interface du jeu, la place libre change.
ipcMain.handle("overlay:placement", (_e, arg) => {
  // L'argument était un simple booléen avant le réglage par jeu : une page
  // servie à une application plus ancienne, ou l'inverse, ne doit pas casser.
  const actif = typeof arg === "object" && arg !== null ? Boolean(arg.actif) : Boolean(arg);
  const jeu = typeof arg === "object" && arg !== null ? arg.jeu ?? jeuCourant : jeuCourant;

  // Pendant le placement, la pastille montre la position du jeu qu'on règle,
  // pas celle du jeu en cours : sinon on déplacerait la mauvaise.
  if (actif) overlay.appliquerConfig(overlayDuJeu(jeu));
  const { placement, position } = overlay.definirPlacement(actif);
  // On n'écrit qu'à la sortie du mode : pendant le déplacement, la position
  // change à chaque pixel.
  if (!placement) ecrireOverlayJeu(jeu, { position });
  return etatOverlay(jeu);
});

/**
 * Rappel affiché par le système. Le site s'appuie sur le push web, qui exige un
 * abonnement auprès du service de notification du navigateur ; Electron n'en a
 * pas, et l'abonnement échouait sans que rien ne le dise. Ici la notification
 * part directement de l'application, qui tourne déjà sur la machine.
 */
ipcMain.on("notif:afficher", (_e, { titre, corps } = {}) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: String(titre || "Win or Workout"),
    body: String(corps || ""),
    icon: path.join(__dirname, "..", "build", "icon.png"),
  });
  // Un rappel sans porte de sortie est une nuisance : le clic ramène la
  // fenêtre, où le décompte attend.
  notification.on("click", () => ouvrirFenetre());
  notification.show();
});

ipcMain.on("fenetre:ouvrir", () => ouvrirFenetre());

// ── Fenêtre principale ───────────────────────────────────────────────────────

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "Win or Workout",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    // Lancée par Windows à l'ouverture de session : on se contente de l'icône
    // près de l'horloge. La fenêtre existe et charge, elle ne s'impose pas.
    show: !lanceAuDemarrage,
    // Couleur du fond avant que la page ne s'affiche. Elle traînait au bleu de
    // l'ancienne identité, ce qui faisait un éclair bleu à chaque ouverture.
    backgroundColor: "#0C0E11",
    ...BARRE_DE_TITRE,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setUserAgent(CHROME_UA);

  // Intercepte les redirections OAuth → ouvre dans le navigateur système.
  // Discord utilise discord.com/api/oauth2 ou discord.com/oauth2 selon la version.
  function isOAuthUrl(url) {
    return (
      url.includes("accounts.google.com") ||
      url.includes("discord.com") && url.includes("oauth2")
    );
  }

  /**
   * Ouvre une adresse dans le navigateur du système, mais seulement si c'en
   * est une.
   *
   * `shell.openExternal` confie l'adresse au système d'exploitation, qui la
   * remet au programme associé au protocole. Sur `http` et `https`, c'est le
   * navigateur. Sur d'autres — `file:`, `smb:`, ou les protocoles internes de
   * Windows — c'est autre chose, et l'adresse vient ici d'une page. Il faudrait
   * d'abord une faille dans la page pour en arriver là, mais la consigne
   * d'Electron est explicite et le filtre ne coûte rien.
   */
  function ouvrirDehors(brut) {
    let adresse;
    try {
      adresse = new URL(brut);
    } catch {
      return;
    }
    if (adresse.protocol !== "http:" && adresse.protocol !== "https:") return;
    shell.openExternal(adresse.toString());
  }

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isOAuthUrl(url)) {
      event.preventDefault();
      if (!canalPret) {
        mainWindow.loadURL(ERREUR_PORT_HTML);
        return;
      }
      // On renvoie vers notre propre page de connexion plutôt que vers l'URL
      // OAuth brute : c'est elle qui porte l'aléa du transfert, et sans lui le
      // canal local refusera le jeton au retour. Un clic de plus dans le
      // navigateur, pour un chemin de repli qui redevient identique à l'autre.
      const nonce = ouvrirAttenteAuth();
      shell.openExternal(`${BACKEND_URL}/connexion-app?p=google&n=${encodeURIComponent(nonce)}`);
      mainWindow.loadURL(WAITING_HTML);
      return;
    }
    // La fenêtre n'a ni barre d'adresse, ni bouton retour, ni menu : une
    // navigation hors du domaine y serait un aller sans retour, sous l'identité
    // de l'application. On la renvoie au navigateur système.
    if (!url.startsWith(BACKEND_URL) && !url.startsWith("data:")) {
      event.preventDefault();
      ouvrirDehors(url);
    }
  });

  // Même chose pour les popups OAuth (window.open).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isOAuthUrl(url) || !url.startsWith(BACKEND_URL)) {
      ouvrirDehors(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Démarrage : si un cookie de session persiste (Rester connecté), on ouvre
  // directement le tableau de bord, que le middleware protège — un cookie
  // expiré ou invalide y renvoie vers /login, et la connexion se rejoue.
  //
  // Viser la page d'accueil ne marche pas : elle est publique et ne redirige
  // plus depuis juin. Un jeton périmé y affichait la page marketing avec un
  // bouton « Se connecter », sans jamais dire que la session était morte.
  let startUrl = `${BACKEND_URL}/login`;
  try {
    const cookies = await mainWindow.webContents.session.cookies.get({
      url: BACKEND_URL,
      name: "__Secure-authjs.session-token",
    });
    if (cookies.length > 0) startUrl = `${BACKEND_URL}/dashboard`;
  } catch {}
  mainWindow.loadURL(startUrl);

  stopWatcher = startLiveClientWatcher((event) => {
    // Les relevés ne concernent que l'overlay : les inonder vers la page
    // déclencherait ses traitements de fin de partie toutes les cinq secondes.
    if (event.type === "game-data") {
      overlay.definirReleve(event);
      // La page recalcule la dette projetée : elle seule connaît le niveau, les
      // pondérations de rôle et les exercices choisis. Canal séparé de
      // « lol:event », qui déclenche les traitements de fin de partie.
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("jeu:releve", event);
      }
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("lol:event",
        event.type === "game-ended" ? { ...event, contexte: contextePartie } : event);
    }

    // L'overlay apparaît de lui-même au début d'une partie et se retire à la
    // fin : c'est le comportement visé, et c'est aussi ce qu'on veut tester.
    const enPartie = event.type === "game-started";
    // L'état d'abord : c'est lui qui permet à l'overlay de se retirer seul si
    // une fin de partie était manquée.
    overlay.definirEnPartie(enPartie, "League of Legends");
    if (enPartie) {
      jeuCourant = "League of Legends";
      // Chaque jeu a sa place libre à l'écran : la pastille se repositionne
      // selon celui qui démarre, pas selon le dernier réglé.
      overlay.appliquerConfig(overlayDuJeu(jeuCourant));
    }
    if (enPartie && overlayAutorise()) overlay.afficher();
    else overlay.masquer();
  });

  // La croix met l'application en veille au lieu de l'arrêter : la détection
  // des parties suppose qu'elle tourne pendant qu'on joue, et personne ne garde
  // une fenêtre ouverte toute une soirée. L'icône près de l'horloge rend cet
  // état visible — c'est elle qui distingue une veille d'un processus fantôme.
  mainWindow.on("close", (event) => {
    if (onQuitte) return;
    // Sans icône, masquer la fenêtre rendrait l'application injoignable : on
    // préfère alors s'arrêter franchement plutôt que de survivre sans issue.
    if (!trayPret) {
      onQuitte = true;
      app.quit();
      return;
    }
    // Une fenêtre déjà invisible n'a pas de croix à cliquer : cette demande-là
    // ne vient pas du joueur, mais de Windows — un installeur, typiquement, qui
    // réclame l'arrêt avant de remplacer les fichiers. La renvoyer en veille
    // laissait l'installation buter sur « ne peut pas être fermé », avec pour
    // seule issue d'aller tuer le processus à la main. On s'arrête, en passant
    // par le nettoyage habituel.
    if (!mainWindow.isVisible()) {
      onQuitte = true;
      app.quit();
      return;
    }
    event.preventDefault();
    mainWindow.hide();
    signalerVeille();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/** Ramène la fenêtre, en la recréant si elle a été détruite. */
function ouvrirFenetre() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Efface le cookie de session quand « Rester connecté » n'était pas coché.
 * Doit être appelé tant que la fenêtre existe : la préférence vit dans son
 * localStorage, et sa session porte le cookie.
 */
async function oublierSessionSiDemande() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const rm = await mainWindow.webContents.executeJavaScript(
      "localStorage.getItem('low_rm')"
    );
    if (rm === "false") {
      await mainWindow.webContents.session.cookies.remove(
        BACKEND_URL,
        "__Secure-authjs.session-token"
      );
    }
  } catch {}
}

// ── Popup d'authentification OAuth (reste dans Electron, pas de Chrome) ────

let authPopup = null;

function openAuthPopup() {
  if (authPopup && !authPopup.isDestroyed()) {
    authPopup.focus();
    return;
  }

  authPopup = new BrowserWindow({
    width: 520,
    height: 720,
    title: "Connexion – Win or Workout",
    backgroundColor: "#0C0E11",
    parent: mainWindow ?? undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Pas de preload → window.electronLOL absent → formulaires web classiques
    },
  });

  authPopup.webContents.setUserAgent(CHROME_UA);
  authPopup.loadURL(`${BACKEND_URL}/login`);

  // Dès que l'OAuth est terminé, Auth.js redirige vers "/" : on transfère le cookie
  authPopup.webContents.on("did-navigate", async (_event, url) => {
    const path = url.split("?")[0];
    const isDashboard =
      url.startsWith(BACKEND_URL) &&
      !path.startsWith(BACKEND_URL + "/login") &&
      !path.startsWith(BACKEND_URL + "/api") &&
      !path.startsWith(BACKEND_URL + "/waitlist");
    if (isDashboard) {
      try {
        const popupCookies = await authPopup.webContents.session.cookies.get({
          url: BACKEND_URL,
          name: "__Secure-authjs.session-token",
        });
        if (popupCookies.length > 0) {
          const targetSession = mainWindow?.webContents?.session ?? electronSession.defaultSession;
          await targetSession.cookies.set({
            url: BACKEND_URL,
            name: "__Secure-authjs.session-token",
            value: popupCookies[0].value,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            expirationDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          });
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`${BACKEND_URL}/dashboard`);
        }
      } catch (err) {
        console.error("[LOW] Erreur transfert session popup:", err);
      } finally {
        if (authPopup && !authPopup.isDestroyed()) authPopup.close();
      }
    }
  });

  authPopup.on("closed", () => { authPopup = null; });
}

// Google bloque l'OAuth dans Electron → on ouvre Chrome, flux port 3099 comme avant.
ipcMain.on("open-google-login", () => {
  // Inutile d'envoyer quelqu'un s'authentifier si le retour est capté ailleurs.
  if (!canalPret) {
    if (mainWindow) mainWindow.loadURL(ERREUR_PORT_HTML);
    return;
  }
  // On ouvre la page qui part D'ELLE-MÊME chez Google. Auparavant on ouvrait la
  // page de connexion ordinaire, où il fallait re-choisir « Google » alors
  // qu'on venait précisément de le demander depuis l'application — un clic pour
  // rien, et une page de plus où quelque chose peut se perdre.
  // `n` prouvera au retour que ce transfert répond bien à cette connexion-ci,
  // et pas à une page ouverte au hasard.
  const nonce = ouvrirAttenteAuth();
  shell.openExternal(`${BACKEND_URL}/connexion-app?p=google&n=${encodeURIComponent(nonce)}`);
  if (mainWindow) mainWindow.loadURL(WAITING_HTML);
});

// Discord fonctionne bien dans un popup Electron natif.
ipcMain.on("open-discord-popup", () => {
  openAuthPopup();
});

// Retour à la page de connexion depuis une page d'attente ou d'échec.
ipcMain.on("auth:retour-connexion", () => {
  if (minuterieAttente) { clearTimeout(minuterieAttente); minuterieAttente = null; }
  attenteAuth = null;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(`${BACKEND_URL}/login`);
});

// ── Mise à jour automatique ─────────────────────────────────────────────────
// L'app compare sa version à la dernière release GitHub et télécharge le
// nouvel installeur en arrière-plan. Il s'applique à la fermeture : on ne
// coupe jamais quelqu'un en pleine partie pour installer une mise à jour.
/**
 * État de la mise à jour, conservé côté application.
 *
 * L'événement de fin de téléchargement peut survenir avant qu'une page soit
 * affichée, ou pendant qu'on est ailleurs dans l'application. S'en remettre au
 * seul message envoyé sur le moment, c'est le perdre : la page qui arrive
 * ensuite doit pouvoir demander où en sont les choses.
 */
let etatMaj = { statut: "inconnu", version: null, erreur: null, progression: 0 };

function majEtat(suivant) {
  etatMaj = { ...etatMaj, ...suivant };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("maj:etat", etatMaj);
  }
}

function initMiseAJour() {
  // Rien à vérifier tant qu'on tourne depuis les sources : la version y est
  // celle du dépôt, et il n'y a pas d'installeur à remplacer.
  if (!app.isPackaged) {
    etatMaj = { statut: "sources", version: null, erreur: null, progression: 0 };
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => majEtat({ statut: "verification", erreur: null }));
  autoUpdater.on("update-available", (info) => majEtat({ statut: "telechargement", version: info?.version ?? null, progression: 0 }));
  // Un installeur pèse plus de 70 Mo : sans jauge, la fenêtre semble figée.
  autoUpdater.on("download-progress", (p) => majEtat({
    statut: "telechargement",
    progression: Math.min(100, Math.max(0, Math.round(p?.percent ?? 0))),
  }));
  autoUpdater.on("update-not-available", () => majEtat({ statut: "a-jour", version: null }));
  autoUpdater.on("update-downloaded", (info) => majEtat({ statut: "prete", version: info?.version ?? null, progression: 100 }));

  // Une mise à jour indisponible ne doit jamais empêcher d'utiliser l'app.
  autoUpdater.on("error", (err) => {
    const message = err?.message ?? String(err);
    console.warn("[WOW] Mise à jour indisponible :", message);
    majEtat({ statut: "erreur", erreur: message });
  });

  autoUpdater.checkForUpdates().catch(() => {});
  // Une vérification toutes les six heures suffit pour une app qu'on laisse
  // ouverte pendant une soirée de jeu.
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("maj:etat", () => etatMaj);
ipcMain.handle("maj:verifier", async () => {
  if (!app.isPackaged) return etatMaj;
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    majEtat({ statut: "erreur", erreur: err?.message ?? String(err) });
  }
  return etatMaj;
});
ipcMain.handle("maj:installer", () => {
  if (etatMaj.statut !== "prete") return false;
  // Le nettoyage de fin passe par `before-quit`, que quitAndInstall déclenche.
  onQuitte = true;
  setImmediate(() => autoUpdater.quitAndInstall());
  return true;
});

// Deux fenêtres de la même application se disputeraient le port de connexion,
// exactement comme le faisaient l'ancienne et la nouvelle. Un second lancement
// ramène donc la fenêtre existante au premier plan plutôt que d'en ouvrir une.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Sans fenêtre à ramener, il faut en recréer une : rendre le focus à une
    // fenêtre détruite ne produisait rien, et l'application semblait refuser
    // de se lancer.
    ouvrirFenetre();
  });
}

app.whenReady().then(() => {
  // Windows exige un identifiant d'application pour afficher les
  // notifications ; sans lui, l'avertissement de mise en veille n'apparaîtrait
  // pas — et c'est justement lui qui évite de croire qu'on a quitté.
  app.setAppUserModelId("com.winorworkout.desktop");

  // « File / Edit / View / Window / Help » : un menu que Windows affiche par
  // défaut, dont aucune entrée ne sert ici, et qui ajoutait une seconde bande
  // claire sous la barre de titre. Les raccourcis d'édition restent gérés par
  // le moteur de rendu, ils ne dépendent pas de ce menu.
  Menu.setApplicationMenu(null);

  // Sans ce filtre, une page peut demander n'importe quel accès — micro,
  // caméra, position — et Electron le lui accorde. On n'ouvre que ce dont
  // l'application se sert, et seulement à nos propres pages : une redirection
  // vers un site tiers n'hérite de rien.
  const PERMISSIONS_OUVERTES = new Set(["notifications", "fullscreen"]);
  electronSession.defaultSession.setPermissionRequestHandler(
    (contenu, permission, accorder) => {
      const origine = contenu?.getURL?.() ?? "";
      accorder(PERMISSIONS_OUVERTES.has(permission) && origine.startsWith(BACKEND_URL));
    },
  );

  startAuthSignalServer();
  // L'overlay est prêt dès le démarrage : Ctrl+Maj+O permet de le vérifier
  // à tout moment, même sans partie en cours.
  // Aucun jeu ne tourne encore : la pastille prend les réglages par défaut,
  // et se replacera au premier jeu détecté.
  stopOverlay = overlay.initOverlay(overlayDuJeu(null));

  /**
   * Raccourci de capture d'écran.
   *
   * Apex n'expose rien : le compteur d'éliminations et le classement n'existent
   * que dessinés à l'écran. Lire ces chiffres suppose d'abord d'en avoir des
   * images — celles de VOTRE résolution et de VOTRE échelle d'interface, parce
   * que les zones à découper en dépendent entièrement.
   *
   * La notification n'est pas un ornement : sans retour, on ne sait pas si le
   * raccourci a été pris par une autre application, et on repart avec un
   * dossier vide.
   */
  const signalerCapture = ({ chemin, raison }) => {
    if (!Notification.isSupported()) return;
    new Notification({
      title: chemin ? "Capture enregistrée" : "Capture impossible",
      body: chemin ? path.basename(chemin) : String(raison || "raison inconnue"),
      icon: path.join(__dirname, "..", "build", "icon.png"),
    }).show();
  };
  const raccourciCapture = initCapture(signalerCapture);
  if (raccourciCapture) {
    console.log(`Capture d'écran : ${raccourciCapture} → ${dossierCaptures()}`);
  } else {
    console.log("Capture d'écran : aucun raccourci disponible, tous sont pris.");
  }

  createWindow();
  try {
    stopTray = initTray({
      ouvrir: ouvrirFenetre,
      quitter: () => app.quit(),
      basculerOverlay: overlay.basculer,
      raccourci: overlay.lireRaccourcis().bascule,
      // Le chemin de secours quand le raccourci global est détenu ailleurs.
      capturer: () => capturer("apex").then(signalerCapture).catch(() => {}),
      raccourciCapture,
      ouvrirCaptures: () => shell.openPath(dossierCaptures()),
      overlayActif: () => overlayAutorise(),
      setOverlayActif: (actif) => {
        // Depuis l'icône, on parle du jeu en cours — ou du défaut hors partie.
        ecrireOverlayJeu(jeuCourant, { actif });
        if (!actif) overlay.masquer();
      },
    });
    trayPret = true;
  } catch (err) {
    console.warn("[WOW] Icône de notification indisponible :", err?.message ?? err);
  }
  stopClient = surveillerClient((e) => {
    if (e.type === "contexte") {
      contextePartie = { file: e.file, role: e.role };
      return;
    }
    // La recherche de partie qui démarre est le premier moment où l'on sait
    // qu'une partie se prépare — bien avant que le jeu ne se lance.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("lol:phase", { phase: e.phase, ...contextePartie });
    }
  });

  stopJeux = surveillerJeux(jeuxSurveilles, ({ type, jeu }) => {
    const actions = actionsDetection();
    if (type === "jeu-demarre") {
      jeuCourant = jeu;
      overlay.definirEnPartie(true, jeu);
      // La pastille prend la place réglée pour CE jeu : l'interface de chacun
      // laisse libre un endroit différent.
      overlay.appliquerConfig(overlayDuJeu(jeu));
      if (actions.overlay && overlayAutorise(jeu)) overlay.afficher();
      if (actions.fenetre) ouvrirFenetre();
    } else if (type === "jeu-arrete") {
      jeuCourant = null;
      overlay.definirEnPartie(false);
      overlay.masquer();
    }
    // Le démarrage de session vit dans la page : c'est elle qui connaît le
    // compte, le niveau et les exercices choisis.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("jeu:detecte", { type, jeu, session: actions.session });
    }
  });

  initMiseAJour();
  app.on("activate", ouvrirFenetre);
});

// Tous les chemins d'arrêt passent ici : menu de l'icône, mise à jour à
// installer, fermeture de session Windows. Le nettoyage a besoin de la page
// encore vivante — d'où le report du départ le temps de le faire.
app.on("before-quit", (event) => {
  onQuitte = true;
  if (nettoyageLance) return;
  nettoyageLance = true;
  event.preventDefault();
  oublierSessionSiDemande().finally(() => {
    if (stopWatcher) stopWatcher();
    if (stopOverlay) stopOverlay();
    if (stopJeux) stopJeux();
    if (stopClient) stopClient();
    if (stopTray) stopTray();
    app.quit();
  });
});

// La fenêtre est masquée, pas fermée : cet événement ne se produit qu'en
// dernier recours. On ne quitte pas de nous-mêmes, l'icône reste le seul juge.
app.on("window-all-closed", () => {});
