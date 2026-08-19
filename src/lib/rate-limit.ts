import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Fenêtre glissante DB-backed (fiable sur serverless, contrairement à un
 * compteur en mémoire qui se réinitialise à chaque cold start).
 * Purge les tentatives expirées à chaque appel pour garder la table petite.
 */
/**
 * Nature de la tentative comptée. Nommée plutôt que répétée : les deux
 * fonctions doivent accepter exactement le même jeu de valeurs, et une liste
 * recopiée finit toujours par diverger.
 */
export type NatureTentative =
  | "login" | "register" | "forgot-code" | "push-test"
  | "game-write";

/**
 * Budget d'une nature de tentative.
 *
 * Cinq essais par quart d'heure convient à un mot de passe ; appliqué à une
 * route que l'application appelle en usage normal, c'est une panne. Le budget
 * vit donc avec la nature plutôt qu'en constante unique, et chaque route dit
 * ce qu'un usage réel consomme.
 */
const BUDGETS: Partial<Record<NatureTentative, { max: number; fenetreMs: number }>> = {
  // Enregistrer une partie est un geste humain : une soirée intense en produit
  // une dizaine. Soixante laisse toute la marge d'un usage normal et arrête
  // net une boucle qui écrirait sans fin.
  "game-write": { max: 60, fenetreMs: WINDOW_MS },
};

function budget(kind: NatureTentative) {
  return BUDGETS[kind] ?? { max: MAX_ATTEMPTS, fenetreMs: WINDOW_MS };
}

export async function isRateLimited(key: string, kind: NatureTentative): Promise<boolean> {
  const { max, fenetreMs } = budget(kind);
  const windowStart = new Date(Date.now() - fenetreMs);

  await prisma.loginAttempt.deleteMany({
    where: { key, kind, createdAt: { lt: windowStart } },
  });

  const count = await prisma.loginAttempt.count({
    where: { key, kind, createdAt: { gte: windowStart } },
  });

  return count >= max;
}

export async function recordAttempt(key: string, kind: NatureTentative): Promise<void> {
  await prisma.loginAttempt.create({ data: { key, kind } }).catch(() => {});
}

export function getClientIp(req: Request): string {
  // Vercel écrase `x-forwarded-for` en entrée et n'y laisse pas passer d'IP
  // externe — la valeur est donc fiable ICI, mais elle ne le serait plus
  // derrière un autre proxy. `x-vercel-forwarded-for` est posé par la
  // plateforme elle-même : le préférer fait que déménager un jour n'ouvre pas
  // en silence la falsification de toutes les limites indexées sur l'adresse.
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
