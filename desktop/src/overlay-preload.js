// Pont minimal pour la fenêtre d'overlay : elle n'a besoin que de recevoir
// l'état poussé par le processus principal, rien d'autre.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayLOW", {
  onEtat: (callback) => {
    const handler = (_event, etat) => callback(etat);
    ipcRenderer.on("overlay:etat", handler);
    return () => ipcRenderer.removeListener("overlay:etat", handler);
  },
});
