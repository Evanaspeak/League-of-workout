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
  // Overlay en jeu : le réglage vit côté application, pas dans le compte —
  // il dépend de la machine et du mode d'affichage, pas du joueur.
  overlayActif: () => ipcRenderer.invoke("overlay:lire"),
  setOverlayActif: (actif) => ipcRenderer.invoke("overlay:ecrire", actif),

  // Mise à jour. `majEtat()` interroge l'état courant, `onMajEtat()` suit ses
  // changements : le téléchargement peut se terminer avant qu'une page soit
  // là pour l'entendre, l'un sans l'autre laisserait passer l'information.
  version: () => ipcRenderer.invoke("app:version"),
  majEtat: () => ipcRenderer.invoke("maj:etat"),
  majVerifier: () => ipcRenderer.invoke("maj:verifier"),
  majInstaller: () => ipcRenderer.invoke("maj:installer"),
  onMajEtat: (callback) => {
    const handler = (_event, etat) => callback(etat);
    ipcRenderer.on("maj:etat", handler);
    return () => ipcRenderer.removeListener("maj:etat", handler);
  },
});
