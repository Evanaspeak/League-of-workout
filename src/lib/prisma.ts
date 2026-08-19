import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

/**
 * Vrai si la base tourne sur la machine même.
 *
 * L'adaptateur Neon parle le protocole HTTP de Neon, pas celui de PostgreSQL :
 * branché sur un serveur local, il transforme `postgresql://…@127.0.0.1:5432/db`
 * en une adresse `https://api.0.0.1/sql` et toutes les routes répondent 500.
 * On ne s'en rendait compte qu'au moment de vouloir vérifier quelque chose
 * pour de bon, et l'on finissait par tester le banc d'essai plutôt que
 * l'application.
 *
 * Le test porte sur l'hôte LOCAL et non sur « est-ce Neon ? » : la production
 * garde ainsi exactement le chemin qu'elle avait, quelle que soit la forme de
 * son adresse.
 */
function baseLocale(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hote = new URL(url).hostname;
    return hote === "localhost" || hote === "127.0.0.1" || hote === "::1";
  } catch {
    return false;
  }
}

function createPrisma() {
  const url = process.env.DATABASE_URL!;
  const adapter = baseLocale(url)
    ? new PrismaPg({ connectionString: url })
    : new PrismaNeonHttp(url, {});
  return new PrismaClient({ adapter } as never);
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
