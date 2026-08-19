import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";

// Configuration "edge-safe" (sans Prisma) — utilisée par le middleware pour
// protéger les routes. La config complète (adapter + callbacks DB) est dans auth.ts.
export const authConfig = {
  providers: [
    // allowDangerousEmailAccountLinking : lie automatiquement un compte OAuth à
    // un utilisateur existant ayant le même email (évite l'erreur
    // OAuthAccountNotLinked).
    //
    // « Sûr car Google et Discord vérifient l'email » : c'était le mauvais
    // modèle de menace. La vérification du fournisseur protège d'une
    // revendication OAuth mensongère, jamais de la ligne LOCALE — que
    // n'importe qui pouvait créer avant l'invité, mot de passe compris, pour
    // récupérer son compte à sa première connexion. Le garde-fou vit
    // maintenant dans le callback `signIn` de `auth.ts` : une connexion OAuth
    // ne prend pas la main sur un compte qui a déjà un mot de passe et n'est
    // pas encore relié à ce fournisseur.
    Google({ allowDangerousEmailAccountLinking: true }),
    Discord({ allowDangerousEmailAccountLinking: true }),
  ],
  trustHost: true,
  session: { strategy: "jwt" as const },
  pages: { signIn: "/login" },
  // Pas de callback `authorized` ici, volontairement.
  //
  // `middleware.ts` enveloppe `auth()` avec sa propre fonction : next-auth
  // exécute alors celle-ci et JETTE le booléen que `authorized` aurait rendu.
  // La liste de routes publiques qui vivait ici n'avait donc aucun effet — un
  // piège de maintenance, où corriger une copie laissait l'autre diverger en
  // silence. La politique tient en un seul endroit : `PUBLIC_PREFIXES`.
} satisfies NextAuthConfig;
