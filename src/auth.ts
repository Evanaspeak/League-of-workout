import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

const BETA_LIMIT = 100;

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
  callbacks: {
    async signIn({ account }) {
      if (!account) return true;
      if (account.type === "credentials") return true;

      const existing = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        include: { user: true },
      });

      if (existing) {
        return (existing.user.betaRank ?? Number.MAX_SAFE_INTEGER) <= BETA_LIMIT;
      }

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
