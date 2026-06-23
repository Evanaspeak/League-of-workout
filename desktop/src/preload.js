const { contextBridge, ipcRenderer } = require("electron");

function subscribe(wantedType, callback) {
  const handler = (_event, payload) => {
    if (payload && payload.type === wantedType) callback(payload);
  };
  ipcRenderer.on("lol:event", handler);
  return () => ipcRenderer.removeListener("lol:event", handler);
}

contextBridge.exposeInMainWorld("electronLOL", {
  isDesktop: true,
  // Google bloque l'OAuth dans Electron → ouvre le navigateur système.
  openGoogleLogin: () => ipcRenderer.send("open-google-login"),
  // Discord fonctionne dans un popup Electron natif.
  openDiscordLogin: () => ipcRenderer.send("open-discord-popup"),
  onGameEnded: (callback) => subscribe("game-ended", callback),
  onGameStarted: (callback) => subscribe("game-started", callback),
});
