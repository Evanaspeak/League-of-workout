// Processus principal de l'app desktop League of Workouts.
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

// Désactive les Client Hints (Sec-CH-UA) qui trahissent Electron auprès de
// Google OAuth même quand le user-agent est spoofé en Chrome standard.
app.commandLine.appendSwitch("disable-features", "UserAgentClientHint");

const BACKEND_URL = process.env.LOW_BACKEND_URL || "http://localhost:3000";
const AUTH_PORT = 3099;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let mainWindow = null;
let stopWatcher = null;

// ── Page d'attente (affichée dans Electron pendant que Chrome gère l'OAuth) ─

const WAITING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>League of Workouts</title>
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

// ── Serveur local d'auth (port 3099) ────────────────────────────────────────
// Chrome (après OAuth) poste le JWT ici pour qu'Electron puisse l'utiliser.

function startAuthSignalServer() {
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
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
            name: "authjs.session-token",
            value: jwt,
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
          });

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(BACKEND_URL);
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
      console.warn(`[LOW] Port ${AUTH_PORT} déjà utilisé — serveur auth ignoré.`);
    }
  });

  server.listen(AUTH_PORT, "127.0.0.1");
}

// ── Fenêtre principale ───────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "League of Workouts",
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

  // Charge la page de login en mode desktop (pour que le redirectTo inclue
  // ?desktop_auth=1 après un OAuth réussi).
  mainWindow.loadURL(`${BACKEND_URL}/login?mode=desktop`);

  stopWatcher = startLiveClientWatcher((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("lol:event", event);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC : le preload l'expose via window.electronLOL.openBrowserLogin()
ipcMain.on("open-browser-login", () => {
  shell.openExternal(`${BACKEND_URL}/login?mode=desktop`);
  if (mainWindow) mainWindow.loadURL(WAITING_HTML);
});

app.whenReady().then(() => {
  startAuthSignalServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (stopWatcher) stopWatcher();
  if (process.platform !== "darwin") app.quit();
});
