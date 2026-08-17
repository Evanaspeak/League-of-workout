export {};

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
    };
  }
}
