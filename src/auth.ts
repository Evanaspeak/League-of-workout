import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

// Nombre de places en beta : seuls les BETA_LIMIT premiers comptes sont admis.
const BETA_LIMIT = 100;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    ...authConfig.callbacks,

    // Garde-fou beta : on n'autorise la création d'un compte que s'il reste
    // de la place. Un utilisateur déjà inscrit (dans le quota) garde l'accès.
    async signIn({ account }) {
      if (!account) return true;

      const existing = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        include: { user: true },
      });

      // Compte déjà lié → autorisé si son rang est dans le quota.
      if (existing) {
        return (existing.user.betaRank ?? Number.MAX_SAFE_INTEGER) <= BETA_LIMIT;
      }

      // Nouveau compte → autorisé seulement si la beta n'est pas pleine.
      const count = await prisma.user.count();
      return count < BETA_LIMIT;
    },

    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },

  events: {
    // À la création d'un compte : on lui attribue son rang d'inscription et
    // on initialise son objectif de pompes par défaut.
    async createUser({ user }) {
      if (!user.id) return;
      const count = await prisma.user.count();
      await prisma.user.update({
        where: { id: user.id },
        data: { betaRank: count, pseudo: user.name ?? "Joueur" },
      });
      await prisma.goal
        .create({ data: { userId: user.id, objectifTotalPompes: 1000 } })
        .catch(() => {});
    },
  },
});
