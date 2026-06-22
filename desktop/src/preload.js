// Pont sécurisé entre le processus principal Electron et la page web chargée.
// Expose un objet `window.electronLOL` que l'app web peut détecter pour savoir
// qu'elle tourne dans l'app desktop, et s'abonner aux événements de partie.

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
  // S'abonne à la fin d'une partie. Renvoie une fonction de désabonnement.
  onGameEnded: (callback) => subscribe("game-ended", callback),
  // S'abonne au début d'une partie. Renvoie une fonction de désabonnement.
  onGameStarted: (callback) => subscribe("game-started", callback),
});
