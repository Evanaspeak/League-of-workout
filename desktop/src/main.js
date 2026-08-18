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

const { app, BrowserWindow, shell, ipcMain, session: electronSession } = require("electron");
const path = require("path");
const http = require("http");
const { startLiveClientWatcher } = require("./liveclient");
const overlay = require("./overlay");
const { initTray, signalerVeille } = require("./tray");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");

// Désactive les Client Hints (Sec-CH-UA) qui trahissent Electron auprès de
// Google OAuth même quand le user-agent est spoofé en Chrome standard.
app.commandLine.appendSwitch("disable-features", "UserAgentClientHint");

const BACKEND_URL = process.env.LOW_BACKEND_URL || "https://winorworkout.com";
const AUTH_PORT = 3099;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let mainWindow = null;
/** Vrai quand c'est bien nous qui écoutons le port de connexion. */
let canalPret = false;
let stopWatcher = null;
let stopOverlay = null;
let stopTray = null;
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
  body { background: #0a1428; color: #c8aa6e; font-family: 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100vh; gap: 16px; }
  h2 { font-size: 20px; letter-spacing: .06em; }
  p  { color: rgba(240,230,211,.5); font-size: 14px; }
  .dots span { animation: blink 1.4s infinite; }
  .dots span:nth-child(2) { animation-delay: .2s; }
  .dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes blink { 0%,80%,100%{opacity:.15} 40%{opacity:1} }
</style></head>
<body>
  <h2>🔐 Authentification en cours <span class="dots"><span>.</span><span>.</span><span>.</span></span></h2>
  <p>Terminez la connexion dans votre navigateur web.</p>
  <p style="font-size:12px;margin-top:8px;color:rgba(240,230,211,.3)">
    Cette fenêtre se met à jour automatiquement une fois connecté.
  </p>
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
  <h2>CONNEXION IMPOSSIBLE</h2>
  <p>Une autre application Win or Workout est déjà ouverte sur cet ordinateur —
     probablement une ancienne version.</p>
  <p style="color:rgba(236,239,244,.35);font-size:13px">
     Fermez-la complètement, puis relancez celle-ci. Sans cela, c'est elle qui
     reçoit la connexion.</p>
</body></html>`)}`;

// ── Serveur local d'auth (port 3099) ────────────────────────────────────────
// Chrome (après OAuth) poste le JWT ici pour qu'Electron puisse l'utiliser.

function startAuthSignalServer() {
  const server = http.createServer((req, res) => {
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
    if (req.method === "GET" && req.url && req.url.startsWith("/set-session")) {
      (async () => {
        try {
          const urlObj = new URL(req.url, `http://127.0.0.1:${AUTH_PORT}`);
          const jwt = urlObj.searchParams.get("t");
          if (!jwt) throw new Error("missing token");

          const ses = mainWindow
            ? mainWindow.webContents.session
            : electronSession.defaultSession;

          await ses.cookies.set({
            url: BACKEND_URL,
            name: "__Secure-authjs.session-token",
            value: jwt,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            // 30-day expiration so the cookie survives app restarts (session cookies disappear on close)
            expirationDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          });

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(`${BACKEND_URL}/dashboard`);
          }

          // Redirect Chrome to desktop-complete which clears Chrome's session and
          // shows a "connection transferred" message — prevents DesktopAuthHandler loop.
          res.writeHead(302, { Location: `${BACKEND_URL}/api/auth/desktop-complete` });
          res.end();
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(String(err));
        }
      })();
      return;
    }

    if (req.method === "POST" && req.url === "/set-session") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", async () => {
        try {
          const { jwt } = JSON.parse(body);
          const ses = mainWindow
            ? mainWindow.webContents.session
            : electronSession.defaultSession;

          await ses.cookies.set({
            url: BACKEND_URL,
            name: "__Secure-authjs.session-token",
            value: jwt,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            expirationDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          });

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(`${BACKEND_URL}/dashboard`);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(500);
          res.end(String(err));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      canalPret = false;
      console.warn(`[WOW] Port ${AUTH_PORT} déjà utilisé — une autre instance détient le canal.`);
    }
  });

  server.listen(AUTH_PORT, "127.0.0.1", () => { canalPret = true; });
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

/** Activé par défaut : il fonctionne en sans bordure, le mode le plus courant. */
function overlayAutorise() {
  return lireReglages().overlay !== false;
}

ipcMain.handle("overlay:lire", () => overlayAutorise());
ipcMain.handle("overlay:ecrire", (_e, actif) => {
  ecrireReglage("overlay", Boolean(actif));
  if (!actif) overlay.masquer();
  return overlayAutorise();
});

// ── Fenêtre principale ───────────────────────────────────────────────────────

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "Win or Workout",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    backgroundColor: "#0a1428",
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

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isOAuthUrl(url)) {
      event.preventDefault();
      if (!canalPret) {
        mainWindow.loadURL(ERREUR_PORT_HTML);
        return;
      }
      shell.openExternal(url);
      mainWindow.loadURL(WAITING_HTML);
    }
  });

  // Même chose pour les popups OAuth (window.open).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isOAuthUrl(url) || !url.startsWith(BACKEND_URL)) {
      shell.openExternal(url);
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("lol:event", event);
    }

    // L'overlay apparaît de lui-même au début d'une partie et se retire à la
    // fin : c'est le comportement visé, et c'est aussi ce qu'on veut tester.
    const enPartie = event.type === "game-started";
    overlay.envoyerEtat({ enPartie });
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
    backgroundColor: "#0a1428",
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
  // ?_desktop=1 est détecté par DesktopModeDetector → localStorage flag → DesktopAuthHandler actif
  shell.openExternal(`${BACKEND_URL}/login?_desktop=1`);
  if (mainWindow) mainWindow.loadURL(WAITING_HTML);
});

// Discord fonctionne bien dans un popup Electron natif.
ipcMain.on("open-discord-popup", () => {
  openAuthPopup();
});

// ── Mise à jour automatique ─────────────────────────────────────────────────
// L'app compare sa version à la dernière release GitHub et télécharge le
// nouvel installeur en arrière-plan. Il s'applique à la fermeture : on ne
// coupe jamais quelqu'un en pleine partie pour installer une mise à jour.
function initMiseAJour() {
  // Rien à vérifier tant qu'on tourne depuis les sources : la version y est
  // celle du dépôt, et il n'y a pas d'installeur à remplacer.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("maj:prete", { version: info?.version ?? null });
    }
  });

  // Une mise à jour indisponible ne doit jamais empêcher d'utiliser l'app.
  autoUpdater.on("error", (err) => {
    console.warn("[WOW] Mise à jour indisponible :", err?.message ?? err);
  });

  autoUpdater.checkForUpdates().catch(() => {});
  // Une vérification toutes les six heures suffit pour une app qu'on laisse
  // ouverte pendant une soirée de jeu.
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

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
  startAuthSignalServer();
  // L'overlay est prêt dès le démarrage : Ctrl+Maj+O permet de le vérifier
  // à tout moment, même sans partie en cours.
  stopOverlay = overlay.initOverlay();
  createWindow();
  try {
    stopTray = initTray({
      ouvrir: ouvrirFenetre,
      quitter: () => app.quit(),
      overlayActif: overlayAutorise,
      setOverlayActif: (actif) => {
        ecrireReglage("overlay", actif);
        if (!actif) overlay.masquer();
      },
    });
    trayPret = true;
  } catch (err) {
    console.warn("[WOW] Icône de notification indisponible :", err?.message ?? err);
  }
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
    if (stopTray) stopTray();
    app.quit();
  });
});

// La fenêtre est masquée, pas fermée : cet événement ne se produit qu'en
// dernier recours. On ne quitte pas de nous-mêmes, l'icône reste le seul juge.
app.on("window-all-closed", () => {});
