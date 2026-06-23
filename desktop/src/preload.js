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
  // Ouvre la page de login dans le navigateur système (contourne les blocages OAuth).
  openBrowserLogin: () => ipcRenderer.send("open-browser-login"),
  onGameEnded: (callback) => subscribe("game-ended", callback),
  onGameStarted: (callback) => subscribe("game-started", callback),
});
