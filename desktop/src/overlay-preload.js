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
  /**
   * Une question posée par-dessus le jeu, avec ses deux réponses.
   *
   * Les mots viennent de la PAGE et non d'ici : c'est elle qui connaît le
   * compte et ses six langues. La coquille ne fait qu'afficher et rendre la
   * réponse. `null` ferme la question sans réponse.
   */
  onQuestion: (callback) => {
    const handler = (_event, q) => callback(q);
    ipcRenderer.on("overlay:question", handler);
    return () => ipcRenderer.removeListener("overlay:question", handler);
  },
  /** La réponse, renvoyée au processus principal qui la relaie à la page. */
  repondre: (id, oui) => ipcRenderer.send("overlay:reponse", { id, oui: Boolean(oui) }),
});
