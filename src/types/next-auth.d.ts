import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Génération de session au moment de l'émission du jeton. */
      epoch?: number;
      /** Instant de l'authentification, en millisecondes. */
      connexion?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    /** Copiée depuis la ligne utilisateur à la connexion, comparée ensuite. */
    epoch?: number;
    /**
     * Instant de l'authentification. Posé une seule fois, à la connexion — pas
     * à chaque rafraîchissement du jeton — pour que l'application desktop
     * puisse distinguer une session obtenue à sa demande d'une session déjà
     * ouverte dans le navigateur.
     */
    connexion?: number;
  }
}
