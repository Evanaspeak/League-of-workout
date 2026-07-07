import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

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
        const email = credentials.email as string;

        // Verrouillage par compte (pas par IP, pour éviter le contournement
        // via botnet distribué) : 5 échecs / 15 min.
        if (await isRateLimited(email, "login")) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) {
          await recordAttempt(email, "login");
          return null;
        }
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) {
          await recordAttempt(email, "login");
          return null;
        }
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
        // 1. Vérifier la liste blanche manuelle (email Google ≠ email candidature)
        const whitelist = await prisma.systemConfig.findUnique({
          where: { key: "betaWhitelistEmails" },
          select: { value: true },
        });
        const whitelistEmails: string[] = whitelist ? JSON.parse(whitelist.value) : [];
        if (whitelistEmails.includes(email)) return true;

        // 2. Vérifier la candidature acceptée
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
        // Fail-closed : si la DB est indisponible, on refuse plutôt que
        // d'accepter n'importe quel compte Google/Discord sans vérification
        // bêta. getCurrentUser() échouerait de toute façon derrière.
        return "/login?error=AccessDenied";
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
