export {};

declare global {
  interface Window {
    electronLOL?: {
      isDesktop: boolean;
      openBrowserLogin: () => void;
      onGameEnded: (callback: () => void) => () => void;
      onGameStarted: (callback: () => void) => () => void;
    };
  }
}
