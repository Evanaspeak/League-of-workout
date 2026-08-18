export {};

/** Ce que le lanceur League sait de la partie : file et rôle attribué. */
export type ContextePartie = {
  file: { id: number | null; nom: string | null; type: string | null; mode: string | null; classee: boolean } | null;
  role: string | null;
};

/** Phase du lanceur, telle qu'il la nomme. */
export type PhaseClient =
  | "None" | "Lobby" | "Matchmaking" | "ReadyCheck" | "ChampSelect"
  | "GameStart" | "InProgress" | "WaitingForStats" | "EndOfGame" | null;

/** Position de l'overlay et raccourcis réellement enregistrés. */
export type EtatOverlay = {
  coin: string;
  coins: string[];
  /** `null` quand aucune combinaison n'a pu être prise par le système. */
  raccourcis: { bascule: string | null; coin: string | null };
};

/** Score du joueur relevé en direct sur l'API locale de League. */
export type ScoreDirect = {
  kills: number; deaths: number; assists: number; cs: number;
  /** Champion joué, tel que le nomme le client du jeu. */
  champion: string | null;
};

/** Détection des jeux en cours d'exécution (application desktop). */
export type ConfigDetection = {
  /** Jeux dont le lancement peut être détecté sur cette machine. */
  disponible: string[];
  surveilles: string[];
  actions: { session: boolean; overlay: boolean; fenetre: boolean };
};

/** État de la mise à jour de l'application desktop. */
export type EtatMaj = {
  statut: "inconnu" | "sources" | "verification" | "telechargement" | "a-jour" | "prete" | "erreur";
  version: string | null;
  erreur: string | null;
  /** Avancement du téléchargement, en pourcentage. */
  progression: number;
};

declare global {
  interface Window {
    electronLOL?: {
      isDesktop: boolean;
      openGoogleLogin: () => void;
      openDiscordLogin: () => void;
      onGameEnded: (callback: () => void) => () => void;
      onGameStarted: (callback: () => void) => () => void;
      // Ajoutés en 0.3.3 : absents des versions installées plus anciennes,
      // d'où l'optionnalité — le réglage ne s'affiche que s'ils existent.
      /** Publie la dette en cours vers l'overlay (0.5.6+). */
      publierDette?: (dette: number) => void;
      /** Coin où se pose l'overlay, et coins possibles (0.5.7+). */
      overlayCoinLire?: () => Promise<EtatOverlay>;
      overlayCoinEcrire?: (coin: string) => Promise<EtatOverlay>;
      /** Partie terminée : dernier relevé connu, pour l'enregistrer (0.6.0+). */
      onPartieTerminee?: (
        callback: (p: {
          score?: ScoreDirect | null; resultat?: "V" | "D" | null; dureeSec?: number;
          contexte?: ContextePartie | null;
        }) => void
      ) => () => void;
      /** Phase du lanceur, avec le contexte connu à ce moment (0.6.1+). */
      onPhase?: (callback: (p: { phase: PhaseClient } & ContextePartie) => void) => () => void;
      /** Relevé de la partie en cours : horloge du jeu et score. */
      onReleve?: (
        callback: (r: { dureeSec: number; score: ScoreDirect | null }) => void
      ) => () => void;
      overlayActif?: () => Promise<boolean>;
      setOverlayActif?: (actif: boolean) => Promise<boolean>;
      // Mise à jour (0.4.1+).
      version?: () => Promise<string>;
      majEtat?: () => Promise<EtatMaj>;
      majVerifier?: () => Promise<EtatMaj>;
      majInstaller?: () => Promise<boolean>;
      onMajEtat?: (callback: (etat: EtatMaj) => void) => () => void;
      // Détection des jeux et lancement au démarrage (0.5.0+).
      detectionLire?: () => Promise<ConfigDetection>;
      detectionEcrire?: (config: Partial<Omit<ConfigDetection, "disponible">>) => Promise<ConfigDetection>;
      onJeuDetecte?: (
        callback: (e: { type: "jeu-demarre" | "jeu-arrete"; jeu: string; session: boolean }) => void
      ) => () => void;
      demarrageLire?: () => Promise<{ actif: boolean; disponible: boolean }>;
      demarrageEcrire?: (actif: boolean) => Promise<{ actif: boolean; disponible: boolean }>;
    };
  }
}
