import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        return user;
      },
    }),
  ],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  // Renvoie les erreurs Auth.js vers /login (au lieu de la page d'erreur par
  // défaut qui plante en 500) + log la cause réelle dans les logs Vercel.
  pages: { signIn: "/login", error: "/login" },
  logger: {
    error(error) {
      console.error("[auth][error]", error);
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return true;
      if (account.type === "credentials") return true;

      const email = user.email?.toLowerCase() ?? "";

      // Admin toujours autorisé
      if (email === "evantocquet@gmail.com") return true;

      try {
        const application = await prisma.betaApplication.findUnique({
          where: { email },
          select: { status: true },
        });

        if (application?.status === "accepted") return true;
        if (application?.status === "rejected") return "/login?error=BetaRejected";
        if (application?.status === "pending") return "/login?error=BetaPending";

        // Aucune candidature
        return "/login?error=AccessDenied";
      } catch (err) {
        console.error("[auth] signIn callback error:", err);
        return true; // fail open si la DB est indisponible
      }
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
    async createUser({ user }) {
      if (!user.id) return;
      try {
        const count = await prisma.user.count();
        await prisma.user.update({
          where: { id: user.id },
          data: { betaRank: count, pseudo: user.name ?? "Joueur" },
        });
        await prisma.goal
          .create({ data: { userId: user.id, objectifTotalPompes: 1000 } })
          .catch(() => {});
      } catch (err) {
        console.error("[auth] createUser event error:", err);
      }
    },
  },
});
