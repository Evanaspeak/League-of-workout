export {};

declare global {
  interface Window {
    electronLOL?: {
      isDesktop: boolean;
      openGoogleLogin: () => void;
      openDiscordLogin: () => void;
      onGameEnded: (callback: () => void) => () => void;
      onGameStarted: (callback: () => void) => () => void;
    };
  }
}
