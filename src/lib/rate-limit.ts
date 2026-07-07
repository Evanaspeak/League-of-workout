import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Fenêtre glissante DB-backed (fiable sur serverless, contrairement à un
 * compteur en mémoire qui se réinitialise à chaque cold start).
 * Purge les tentatives expirées à chaque appel pour garder la table petite.
 */
export async function isRateLimited(key: string, kind: "login" | "register"): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  await prisma.loginAttempt.deleteMany({
    where: { key, kind, createdAt: { lt: windowStart } },
  });

  const count = await prisma.loginAttempt.count({
    where: { key, kind, createdAt: { gte: windowStart } },
  });

  return count >= MAX_ATTEMPTS;
}

export async function recordAttempt(key: string, kind: "login" | "register"): Promise<void> {
  await prisma.loginAttempt.create({ data: { key, kind } }).catch(() => {});
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
