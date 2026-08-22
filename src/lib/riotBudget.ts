import { isRateLimited, recordAttempt, recordAttempts, resteAuBudget } from "@/lib/rate-limit";

/**
 * Le budget de la clé Riot, partagé par tous les comptes.
 *
 * Ce qui a motivé ce fichier, mesuré sur les routes elles-mêmes :
 *
 *   - `/api/riot/last-game` coûte DEUX requêtes Riot (la liste, puis le match).
 *     Le mode session l'appelle toutes les deux minutes.
 *   - `/api/riot/match-history` en coûte jusqu'à VINGT ET UNE (la liste, puis
 *     vingt matchs), moins ce que le cache mémoire a retenu — un cache qui
 *     disparaît à chaque démarrage à froid.
 *
 * Une clé de développement autorise cent requêtes par deux minutes. Le mode
 * session seul plafonne donc à une cinquantaine de joueurs simultanés, et une
 * seule ouverture de l'historique en coûte autant que dix joueurs qui jouent.
 * C'est la réponse chiffrée à « est-ce que ça tient à cent » : non, pas avec
 * cette clé.
 *
 * Ce que ce garde-fou change : au lieu que la clé rende des 429 à tout le monde
 * en même temps — et que la reprise automatique de `riotFetch` double la charge
 * au pire moment — les appels en trop sont refusés ici, avant de partir.
 */

/** Une seule clé, donc un seul compteur : le budget n'est pas par compte. */
const CLE = "riot";

/** Ce qu'un appel de route coûte à la clé, requête par requête. */
export const COUT = {
  /** La liste des identifiants, puis le détail du dernier match. */
  dernierePartie: 2,
  /** La liste, puis jusqu'à vingt matchs — le cache en enlève une partie. */
  historique: 21,
} as const;

export type RefusRiot = { raison: "compte" | "cle" };

/**
 * Réserve `cout` requêtes sur la clé pour le compte donné.
 *
 * Deux verrous, dans cet ordre : celui du compte, qui arrête une page relancée
 * en boucle ; puis celui de la clé, qui arrête cent comptes raisonnables.
 *
 * La réservation est posée AVANT les appels : sinon deux requêtes simultanées
 * verraient toutes les deux du budget libre et partiraient toutes les deux.
 *
 * @returns `null` si l'appel peut partir, sinon la raison du refus.
 */
export async function reserverRiot(userId: string, cout: number): Promise<RefusRiot | null> {
  if (await isRateLimited(userId, "riot-read")) return { raison: "compte" };

  const reste = await resteAuBudget(CLE, "riot-cle");
  if (reste < cout) return { raison: "cle" };

  await recordAttempt(userId, "riot-read");
  await recordAttempts(CLE, "riot-cle", cout);
  return null;
}

/**
 * Rend au budget ce qui n'a finalement pas été dépensé.
 *
 * L'historique réserve vingt et une requêtes et n'en fait souvent que deux ou
 * trois, le cache ayant le reste. Ne rien rendre reviendrait à fermer la clé à
 * tout le monde pour des requêtes qui ne sont jamais parties.
 *
 * Rien n'est rendu si l'écart est négatif : on ne compense pas une sous-estimation
 * en volant du budget aux autres.
 */
export async function rendreAuBudget(reserve: number, depense: number): Promise<void> {
  const aRendre = Math.max(0, reserve - depense);
  if (aRendre === 0) return;
  const { prisma } = await import("@/lib/prisma");
  // On retire les plus récentes : ce sont celles qu'on vient de poser.
  const trop = await prisma.loginAttempt.findMany({
    where: { key: CLE, kind: "riot-cle" },
    orderBy: { createdAt: "desc" },
    take: aRendre,
    select: { id: true },
  }).catch(() => [] as { id: string }[]);
  if (trop.length === 0) return;
  await prisma.loginAttempt
    .deleteMany({ where: { id: { in: trop.map((t) => t.id) } } })
    .catch(() => {});
}

/** Le message rendu au navigateur, selon le verrou qui a cédé. */
export function messageRefus(refus: RefusRiot): string {
  return refus.raison === "compte"
    ? "Trop de synchronisations en peu de temps. Réessayez dans quelques minutes."
    : "La synchronisation Riot est saturée en ce moment. Réessayez dans deux minutes.";
}
