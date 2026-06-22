// Processus principal de l'app desktop League of Workouts.
//
// Rôle :
//  1. Ouvrir une fenêtre native qui charge l'app web (réutilise auth + UI).
//  2. Surveiller l'API Live Client de League et transmettre les événements
//     "début / fin de partie" à la page web via le preload.

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { startLiveClientWatcher } = require("./liveclient");

// URL du backend. En dev : le serveur Next local. Surchargée par variable
// d'environnement pour pointer vers le site déployé en prod.
const BACKEND_URL = process.env.LOW_BACKEND_URL || "http://localhost:3000";

// User-agent type Chrome : évite que Google bloque l'OAuth en le prenant pour
// un navigateur embarqué non sécurisé ("disallowed_useragent").
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let mainWindow = null;
let stopWatcher = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "League of Workouts",
    backgroundColor: "#0a1428",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // Session persistante : garde la connexion entre deux lancements.
      partition: "persist:low",
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setUserAgent(CHROME_UA);
  mainWindow.loadURL(BACKEND_URL);

  // Les liens hors-app (docs, etc.) s'ouvrent dans le navigateur système.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(BACKEND_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Surveillance des parties → on relaie chaque événement à la page web.
  stopWatcher = startLiveClientWatcher((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("lol:event", event);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (stopWatcher) stopWatcher();
  if (process.platform !== "darwin") app.quit();
});
