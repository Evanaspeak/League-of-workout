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
  // Sortie de secours depuis la page d'attente : rien n'y ramenait la
  // connexion, et la fenêtre restait bloquée sur son animation.
  retourConnexion: () => ipcRenderer.send("auth:retour-connexion"),
  onGameEnded: (callback) => subscribe("game-ended", callback),
  onGameStarted: (callback) => subscribe("game-started", callback),
  // Overlay en jeu : le réglage vit côté application, pas dans le compte —
  // il dépend de la machine et du mode d'affichage, pas du joueur.
  // La dette est calculée par la page ; l'overlay ne fait que l'afficher.
  publierDette: (dette) => ipcRenderer.send("overlay:dette", dette),
  overlayCoinLire: () => ipcRenderer.invoke("overlay:coin-lire"),
  overlayCoinEcrire: (coin) => ipcRenderer.invoke("overlay:coin-ecrire", coin),
  /**
   * Réglages d'overlay jeu par jeu. La place libre à l'écran dépend de
   * l'interface du jeu : un réglage unique obligeait à le refaire à chaque
   * changement.
   */
  overlayJeuxLire: () => ipcRenderer.invoke("overlay:jeux-lire"),
  overlayJeuEcrire: (jeu, patch) => ipcRenderer.invoke("overlay:jeu-ecrire", { jeu, ...patch }),
  /** Partie terminée, avec le dernier relevé : de quoi l'enregistrer. */
  onPartieTerminee: (callback) => {
    const handler = (_event, payload) => {
      if (payload && payload.type === "game-ended") {
        callback({ ...(payload.partie ?? {}), contexte: payload.contexte ?? null });
      }
    };
    ipcRenderer.on("lol:event", handler);
    return () => ipcRenderer.removeListener("lol:event", handler);
  },
  /** Phase du lanceur : Lobby, Matchmaking, ChampSelect, InProgress… */
  onPhase: (callback) => {
    const handler = (_event, p) => callback(p);
    ipcRenderer.on("lol:phase", handler);
    return () => ipcRenderer.removeListener("lol:phase", handler);
  },
  /** Relevé de la partie en cours, cinq secondes d'intervalle. */
  onReleve: (callback) => {
    const handler = (_event, releve) => callback(releve);
    ipcRenderer.on("jeu:releve", handler);
    return () => ipcRenderer.removeListener("jeu:releve", handler);
  },
  overlayActif: () => ipcRenderer.invoke("overlay:lire"),
  setOverlayActif: (actif) => ipcRenderer.invoke("overlay:ecrire", actif),

  /**
   * Rappel affiché par Windows lui-même.
   *
   * Le site passe par le push web : un abonnement auprès du service de
   * notification du navigateur. Electron n'embarque pas les identifiants de ce
   * service, l'abonnement échoue, et le bouton « Activer » ne pouvait donc rien
   * donner. Ici la notification est locale — pas de serveur, pas d'abonnement,
   * et de toute façon l'application tourne déjà sur la machine.
   */
  notifier: (titre, corps) => ipcRenderer.send("notif:afficher", { titre, corps }),
  /** Ouvre la fenêtre : c'est ce que fait un clic sur la notification. */
  ouvrirFenetre: () => ipcRenderer.send("fenetre:ouvrir"),

  /**
   * Chiffres lus sur l'écran d'Apex, poussés vers la page.
   *
   * La lecture se fait dans l'application, qui seule voit l'écran ; c'est la
   * page qui enregistre, parce qu'elle seule porte la session du compte.
   */
  onPartieLue: (callback) => {
    const handler = (_e, donnees) => callback(donnees);
    ipcRenderer.on("apex:partie-lue", handler);
    return () => ipcRenderer.removeListener("apex:partie-lue", handler);
  },

  /**
   * Ce que la page veut afficher dans la pastille.
   *
   * Passer par une notification Windows ne servirait à rien : dès qu'un jeu
   * tourne, l'Assistant de concentration les supprime toutes.
   */
  direDansOverlay: (texte, ok) => ipcRenderer.send("overlay:message", { texte, ok }),

  // Placement libre de l'overlay : le mode saisie rend la pastille attrapable
  // à la souris, le temps de la poser où elle ne gêne pas.
  overlayPlacement: (actif, jeu) => ipcRenderer.invoke("overlay:placement", { actif, jeu }),
  /**
   * Pose une question par-dessus le jeu et rend la réponse (0.9.10+).
   *
   * Les mots viennent d'ici, donc de la page, qui connaît le compte et ses six
   * langues. Rend `null` quand personne n'a répondu avant la fin du délai : à
   * traiter comme un refus, jamais comme un accord.
   */
  overlayDemander: (question) => ipcRenderer.invoke("overlay:question", question),

  // Mise à jour. `majEtat()` interroge l'état courant, `onMajEtat()` suit ses
  // changements : le téléchargement peut se terminer avant qu'une page soit
  // là pour l'entendre, l'un sans l'autre laisserait passer l'information.
  version: () => ipcRenderer.invoke("app:version"),
  majEtat: () => ipcRenderer.invoke("maj:etat"),
  majVerifier: () => ipcRenderer.invoke("maj:verifier"),
  majInstaller: () => ipcRenderer.invoke("maj:installer"),
  // Détection des jeux : quels jeux surveiller, et ce que leur lancement
  // déclenche. Le démarrage de session revient à la page, seule à connaître le
  // compte et le niveau.
  detectionLire: () => ipcRenderer.invoke("detection:lire"),
  detectionEcrire: (config) => ipcRenderer.invoke("detection:ecrire", config),
  onJeuDetecte: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("jeu:detecte", handler);
    return () => ipcRenderer.removeListener("jeu:detecte", handler);
  },

  // Lancement à l'ouverture de session Windows, sans fenêtre.
  demarrageLire: () => ipcRenderer.invoke("demarrage:lire"),
  demarrageEcrire: (actif) => ipcRenderer.invoke("demarrage:ecrire", actif),

  onMajEtat: (callback) => {
    const handler = (_event, etat) => callback(etat);
    ipcRenderer.on("maj:etat", handler);
    return () => ipcRenderer.removeListener("maj:etat", handler);
  },
});
