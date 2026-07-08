import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";

// Configuration "edge-safe" (sans Prisma) — utilisée par le middleware pour
// protéger les routes. La config complète (adapter + callbacks DB) est dans auth.ts.
export const authConfig = {
  providers: [
    // allowDangerousEmailAccountLinking : lie automatiquement un compte OAuth à
    // un utilisateur existant ayant le même email (évite l'erreur
    // OAuthAccountNotLinked). Sûr car Google et Discord vérifient l'email.
    Google({ allowDangerousEmailAccountLinking: true }),
    Discord({ allowDangerousEmailAccountLinking: true }),
  ],
  trustHost: true,
  session: { strategy: "jwt" as const },
  pages: { signIn: "/login" },
  callbacks: {
    // Détermine si une requête est autorisée (middleware).
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/beta") ||
        pathname.startsWith("/api/beta") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/waitlist") ||
        pathname.startsWith("/cgu") ||
        pathname.startsWith("/confidentialite") ||
        pathname.startsWith("/telechargement") ||
        pathname.startsWith("/recuperation") ||
        pathname.startsWith("/api/auth");
      if (isPublic) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
