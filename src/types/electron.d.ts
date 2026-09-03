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
  raccourcis: { bascule: string | null; coin: string | null; capture?: string | null };
  /** Mode placement en cours : la pastille se laisse attraper à la souris. */
  placement: boolean;
  /** Position posée à la main, ou `null` si c'est encore le coin qui décide. */
  position: { x: number; y: number } | null;
  libre: boolean;
};

/** Réglage d'overlay pour un jeu donné. */
export type OverlayJeu = {
  actif: boolean;
  coin: string;
  position: { x: number; y: number } | null;
};

/** Tous les réglages d'overlay, jeu par jeu (0.6.4+). */
export type EtatOverlayJeux = {
  /** Jeux dont on sait détecter le lancement : eux seuls sont réglables. */
  jeux: string[];
  coins: string[];
  raccourcis: { bascule: string | null; coin: string | null; capture?: string | null };
  placement: boolean;
  config: Record<string, OverlayJeu>;
};

/**
 * Ce que la partie en cours coûtera, déjà formaté dans l'unité de l'exercice
 * choisi. `null` hors partie.
 */
export type ProjectionDette = {
  victoire: string;
  defaite: string;
  /** Effort déjà dû, hors partie en cours. Chaîne vide s'il n'y en a pas. */
  enAttente: string;
} | null;

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
      /**
       * Publie vers l'overlay ce que la partie en cours coûtera (0.6.2+).
       * Portait un simple nombre en 0.5.6 : la dette de session, restée à zéro
       * faute de suivi Riot.
       */
      publierDette?: (dette: ProjectionDette) => void;
      /** Coin où se pose l'overlay, et coins possibles (0.5.7+). */
      overlayCoinLire?: () => Promise<EtatOverlay>;
      overlayCoinEcrire?: (coin: string) => Promise<EtatOverlay>;
      /** Réglages d'overlay jeu par jeu (0.6.4+). */
      overlayJeuxLire?: () => Promise<EtatOverlayJeux>;
      overlayJeuEcrire?: (jeu: string, patch: Partial<OverlayJeu>) => Promise<EtatOverlayJeux>;
      /**
       * Mode placement : la pastille devient attrapable à la souris (0.6.2+).
       * `jeu` désigne le réglage à modifier ; absent, c'est celui du jeu en
       * cours.
       */
      overlayPlacement?: (actif: boolean, jeu?: string) => Promise<EtatOverlay>;
      /**
       * Pose une question par-dessus le jeu et rend la réponse (0.9.10+).
       *
       * Les mots viennent de la page : elle seule connaît le compte et ses six
       * langues. `null` = personne n'a répondu à temps, ce qui se traite comme
       * un refus.
       */
      overlayDemander?: (question: {
        texte: string; oui: string; non: string; delaiMs?: number;
      }) => Promise<boolean | null>;
      /**
       * Tait la pastille pour la partie en cours, et pour elle seule (0.9.12+).
       *
       * Appelée sur un refus explicite de session. Elle revient à la partie
       * suivante, et aucun réglage n'est touché. Absente d'une application
       * plus ancienne : la pastille reste alors affichée, ce qui est le
       * comportement d'avant — jamais un réglage coupé à l'insu de quelqu'un.
       */
      overlayMasquerPartie?: () => Promise<boolean>;
      /** Rappel affiché par le système, sans passer par le push web (0.6.2+). */
      notifier?: (titre: string, corps: string) => void;
      ouvrirFenetre?: () => void;
      /** Partie terminée : dernier relevé connu, pour l'enregistrer (0.6.0+). */
      onPartieTerminee?: (
        callback: (p: {
          score?: ScoreDirect | null; resultat?: "V" | "D" | null; dureeSec?: number;
          /** Pourquoi l'issue manque, quand le lanceur a su le dire (0.9.6+). */
          motifSansResultat?: "remake" | "desaccord" | "inconnu" | null;
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
      /** Chiffres lus sur l'écran d'Apex, poussés par l'application (0.8+). */
      onPartieLue?: (
        callback: (lu: {
          jeu: string;
          classement: number;
          eliminations: number;
          /** Modes de lecture d'accord, sur le nombre essayé. */
          accord: number;
          essais: number;
          /** Vrai quand les éliminations ont fait l'unanimité. */
          elimSures: boolean;
        }) => void
      ) => () => void;
      /** Affiche un message dans la pastille : Windows tait ses notifications en jeu. */
      direDansOverlay?: (texte: string, ok: boolean) => void;
      demarrageLire?: () => Promise<{ actif: boolean; disponible: boolean }>;
      demarrageEcrire?: (actif: boolean) => Promise<{ actif: boolean; disponible: boolean }>;
    };
  }
}
