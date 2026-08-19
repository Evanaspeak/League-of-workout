import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Génération de session au moment de l'émission du jeton. */
      epoch?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    /** Copiée depuis la ligne utilisateur à la connexion, comparée ensuite. */
    epoch?: number;
  }
}
