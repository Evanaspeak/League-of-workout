import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";
import { estAdmin } from "@/lib/admin";
import { porteMotDePasse } from "@/lib/porteBeta";
import { normaliserEmail } from "@/lib/identite";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        // "identifier" = email OU pseudo ; "password" = mot de passe OU code.
        email: { label: "Email ou pseudo", type: "text" },
        password: { label: "Mot de passe ou code", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const identifier = (credentials.email as string).trim();
        const secret = credentials.password as string;

        // Le verrou porte sur l'identifiant ET l'adresse d'où vient la
        // tentative. Sur l'identifiant seul, il protégeait du botnet distribué
        // mais donnait à n'importe qui le moyen de fermer le compte d'un
        // autre : cinq mots de passe faux, et le propriétaire légitime se
        // heurtait au même refus que l'attaquant. Les deux réunis, chacun ne
        // consomme que son propre budget.
        const cle = `${identifier.toLowerCase()}|${getClientIp(req as unknown as Request)}`;
        if (await isRateLimited(cle, "login")) return null;

        // Un "@" => email. La recherche vise la forme canonique, celle que
        // l'inscription écrit désormais : chercher la casse tapée retrouverait
        // les lignes en casse mixte que l'ancienne inscription a pu laisser.
        const email = identifier.includes("@") ? normaliserEmail(identifier) : null;
        const user = identifier.includes("@")
          ? (email ? await prisma.user.findUnique({ where: { email } }) : null)
          : await prisma.user.findFirst({
              where: {
                pseudo: { equals: identifier, mode: "insensitive" },
                passwordHash: { not: null },
              },
              // Des pseudos en double existent en base. Sans ordre explicite,
              // c'est le plan d'exécution qui décide lequel répond — donc un
              // tirage au sort à chaque connexion. Le plus ancien gagne.
              orderBy: { createdAt: "asc" },
            });

        if (!user?.passwordHash) {
          await recordAttempt(cle, "login");
          return null;
        }
        const valid = await bcrypt.compare(secret, user.passwordHash);
        if (!valid) {
          await recordAttempt(cle, "login");
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

      // Deux régimes, depuis l'ouverture de la bêta :
      //   — Google et Discord entrent librement ;
      //   — le mot de passe reste sur invitation, liste blanche ou candidature
      //     acceptée. Cette porte-là ne s'appliquait autrefois qu'à l'OAuth,
      //     et le mot de passe — le chemin que tout le monde emprunte — la
      //     contournait entièrement.
      const email = user.email?.toLowerCase() ?? "";

      // Admin toujours autorisé
      if (estAdmin(email)) return true;

      // Un compte pseudo+code n'a pas d'adresse : il vient forcément de la
      // route d'accès bêta, qui est elle-même la porte d'entrée officielle.
      if (account.type === "credentials" && !email) return true;

      // Une connexion OAuth ne prend pas la main sur un compte qui a déjà un
      // mot de passe et qui n'est pas encore relié à ce fournisseur.
      //
      // La liaison automatique par e-mail suppose que le fournisseur a vérifié
      // l'adresse — c'est vrai, et ça protège d'une revendication OAuth
      // mensongère. Mais elle ne dit rien de la ligne locale : n'importe qui
      // pouvait l'avoir créée avant l'invité, mot de passe compris, et
      // récupérait ainsi son compte au moment où il se connectait pour la
      // première fois. On refuse, et on lui dit par où passer.
      if (account.type === "oauth" || account.type === "oidc") {
        try {
          const local = email
            ? await prisma.user.findUnique({
                where: { email },
                select: { id: true, passwordHash: true },
              })
            : null;
          if (local?.passwordHash) {
            const dejaRelie = await prisma.account.findFirst({
              where: { userId: local.id, provider: account.provider },
              select: { id: true },
            });
            if (!dejaRelie) return "/login?error=CompteExistant";
          }

          // Bêta ouverte : arriver par Google ou Discord suffit, plus besoin
          // d'attendre qu'une candidature soit acceptée. Le contrôle ci-dessus
          // reste, lui : il ne parle pas d'invitation mais de reprise de
          // compte, et rien dans l'ouverture de la bêta ne le rend inutile.
          //
          // Un refus explicite continue de valoir refus — c'est désormais le
          // seul moyen d'écarter quelqu'un.
          const refus = await prisma.betaApplication.findUnique({
            where: { email },
            select: { status: true },
          });
          if (refus?.status === "rejected") return "/login?error=BetaRejected";
          return true;
        } catch (err) {
          console.error("[auth] verification de liaison:", err);
          return "/login?error=AccessDenied";
        }
      }

      // À partir d'ici : uniquement les comptes à mot de passe. Google et
      // Discord sont sortis plus haut, la bêta leur étant ouverte.
      try {
        // La règle vit dans `porteBeta`, consultée aussi par la création de
        // compte. Elle était écrite ici seulement : le formulaire d'inscription
        // ne la connaissait pas et fabriquait des comptes inutilisables.
        const porte = await porteMotDePasse(email);
        if (porte.ouverte) return true;
        if (porte.raison === "refusee") return "/login?error=BetaRejected";
        if (porte.raison === "en-attente") return "/login?error=BetaPending";
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
      if (user?.id) {
        token.uid = user.id;
        // Uniquement ici, donc à la connexion : les rafraîchissements suivants
        // passent sans `user` et laissent l'horodatage intact.
        token.connexion = Date.now();
        // Une lecture par connexion, pas par requête : on grave la génération
        // en cours dans le jeton, et c'est `getCurrentUser()` qui la comparera
        // ensuite — il relit déjà la ligne, donc ça ne coûte rien de plus.
        try {
          const ligne = await prisma.user.findUnique({
            where: { id: user.id },
            select: { sessionEpoch: true },
          });
          token.epoch = ligne?.sessionEpoch ?? 0;
        } catch {
          token.epoch = 0;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
        session.user.epoch = typeof token.epoch === "number" ? token.epoch : 0;
        if (typeof token.connexion === "number") session.user.connexion = token.connexion;
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
