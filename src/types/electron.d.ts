// Type de l'API exposée par l'app desktop (Electron) via le preload.
// Présent uniquement quand l'app web tourne dans League of Workouts Desktop ;
// `undefined` dans un navigateur classique.
export {};

declare global {
  interface Window {
    electronLOL?: {
      isDesktop: boolean;
      onGameEnded: (callback: () => void) => () => void;
      onGameStarted: (callback: () => void) => () => void;
    };
  }
}
