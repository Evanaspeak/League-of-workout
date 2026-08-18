export {};

/** État de la mise à jour de l'application desktop. */
export type EtatMaj = {
  statut: "inconnu" | "sources" | "verification" | "telechargement" | "a-jour" | "prete" | "erreur";
  version: string | null;
  erreur: string | null;
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
      overlayActif?: () => Promise<boolean>;
      setOverlayActif?: (actif: boolean) => Promise<boolean>;
      // Mise à jour (0.4.1+).
      version?: () => Promise<string>;
      majEtat?: () => Promise<EtatMaj>;
      majVerifier?: () => Promise<EtatMaj>;
      majInstaller?: () => Promise<boolean>;
      onMajEtat?: (callback: (etat: EtatMaj) => void) => () => void;
    };
  }
}
