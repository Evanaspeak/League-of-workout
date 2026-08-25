// Pont minimal pour la fenêtre d'overlay : elle n'a besoin que de recevoir
// l'état poussé par le processus principal, rien d'autre.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayLOW", {
  onEtat: (callback) => {
    const handler = (_event, etat) => callback(etat);
    ipcRenderer.on("overlay:etat", handler);
    return () => ipcRenderer.removeListener("overlay:etat", handler);
  },
  /** Les mots de la pastille, dans la langue du compte. */
  onTextes: (callback) => {
    const handler = (_event, T) => callback(T);
    ipcRenderer.on("overlay:textes", handler);
    return () => ipcRenderer.removeListener("overlay:textes", handler);
  },
  /** Mode placement : la pastille se laisse attraper à la souris. */
  onPlacement: (callback) => {
    const handler = (_event, actif) => callback(Boolean(actif));
    ipcRenderer.on("overlay:placement", handler);
    return () => ipcRenderer.removeListener("overlay:placement", handler);
  },
});
