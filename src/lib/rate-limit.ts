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
  | "game-write" | "riot-lookup" | "riot-read" | "riot-cle"
  | "signalement";

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
  // Relier son compte Riot se fait une fois, deux si on s'est trompé de
  // région. Chaque appel consomme le quota de la clé du serveur, qui est
  // partagée par tout le monde : sans borne, un seul compte peut la vider et
  // priver les autres de la synchronisation.
  "riot-lookup": { max: 20, fenetreMs: WINDOW_MS },
  // Lecture des parties, par compte. Le mode session interroge Riot toutes les
  // deux minutes, soit sept ou huit fois par quart d'heure ; l'historique
  // s'ouvre quelques fois de plus. Quarante laisse de la marge et arrête une
  // page rechargée en boucle.
  "riot-read": { max: 40, fenetreMs: WINDOW_MS },
  /**
   * Budget de la CLÉ, tous comptes confondus. C'est le seul garde-fou qui vaille
   * pour une ressource partagée : une limite par compte n'empêche pas cent
   * comptes de vider la clé en usage parfaitement normal.
   *
   * Une clé de développement autorise cent requêtes par deux minutes. On compte
   * ici des requêtes Riot, pas des appels de route — l'historique en fait
   * vingt et une à lui seul. Quatre-vingt-dix laisse dix requêtes de marge pour
   * ce qui part sans passer par ici.
   */
  "riot-cle": { max: 90, fenetreMs: 2 * 60 * 1000 },
  // Signaler un problème est ouvert sans session : la borne porte sur
  // l'adresse. Cinq par quart d'heure laisse décrire plusieurs soucis d'affilée
  // et ferme la porte à qui voudrait remplir la table.
  "signalement": { max: 5, fenetreMs: WINDOW_MS },
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

/**
 * Compte plusieurs tentatives d'un coup.
 *
 * Un appel de route peut coûter vingt et une requêtes à une clé partagée : le
 * budget doit compter ce qui part vraiment, pas le nombre d'appels reçus.
 */
export async function recordAttempts(
  key: string, kind: NatureTentative, nombre: number,
): Promise<void> {
  const n = Math.max(0, Math.round(nombre));
  if (n === 0) return;
  await prisma.loginAttempt
    .createMany({ data: Array.from({ length: n }, () => ({ key, kind })) })
    .catch(() => {});
}

/**
 * Ce qu'il reste au budget d'une nature, sans rien consommer.
 *
 * Sert à répondre « revenez dans un instant » plutôt qu'à laisser partir un
 * appel qui reviendra en 429 — et surtout à ne pas déclencher la reprise
 * automatique de `riotFetch`, qui multiplierait la charge au moment précis où
 * elle est déjà trop haute.
 */
export async function resteAuBudget(key: string, kind: NatureTentative): Promise<number> {
  const { max, fenetreMs } = budget(kind);
  const debut = new Date(Date.now() - fenetreMs);
  const utilise = await prisma.loginAttempt.count({
    where: { key, kind, createdAt: { gte: debut } },
  });
  return Math.max(0, max - utilise);
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
