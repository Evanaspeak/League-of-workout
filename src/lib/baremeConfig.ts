import { prisma } from "@/lib/prisma";

/**
 * La configuration du barème, lue une fois par minute plutôt qu'à chaque appel.
 *
 * Trois tables — pondérations par rôle, paliers de niveau, maîtrise — décrivent
 * comment une partie se convertit en points. Elles sont GLOBALES : la même
 * réponse pour tout le monde, et elles changent quand un administrateur touche
 * au barème, c'est-à-dire à peu près jamais.
 *
 * Elles étaient pourtant relues à chaque partie enregistrée, à chaque aperçu de
 * score, à chaque correction de résultat et à chaque ouverture des réglages :
 * trois allers-retours à chaque fois. En production chaque requête SQL est un
 * appel HTTPS indépendant vers Neon.
 *
 * Même mécanique que `chargerRatios`, et pour la même raison. La minute de
 * latence est le prix, et il est écrit : une modification met au pire soixante
 * secondes à se propager sur les autres instances — celle qui reçoit
 * l'enregistrement vide son cache tout de suite et la voit immédiatement.
 */

/**
 * Les types viennent du client engendré : les recopier à la main est le plus
 * sûr moyen de les faire diverger du schéma à la première colonne ajoutée.
 */
export type Bareme = {
  roleWeights: Awaited<ReturnType<typeof prisma.roleWeight.findMany>>;
  levelConfigs: Awaited<ReturnType<typeof prisma.levelConfig.findMany>>;
  masteryConfig: Awaited<ReturnType<typeof prisma.masteryConfig.findFirst>>;
};

const TTL_MS = 60_000;

let cache: { valeurs: Bareme; expire: number } | null = null;

export async function chargerBareme(): Promise<Bareme> {
  if (cache && Date.now() < cache.expire) return cache.valeurs;

  const [roleWeights, levelConfigs, masteryConfig] = await Promise.all([
    prisma.roleWeight.findMany({ orderBy: { role: "asc" } }),
    prisma.levelConfig.findMany({ orderBy: { niveau: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  const valeurs: Bareme = { roleWeights, levelConfigs, masteryConfig };
  /**
   * Un barème vide ne se met pas en cache.
   *
   * Sur une base neuve, l'amorçage n'a pas encore eu lieu au premier appel :
   * garder ce vide pendant une minute ferait échouer tout ce qui calcule un
   * score, et le message serait « Config manquante » sur une base parfaitement
   * semée quelques millisecondes plus tard.
   */
  if (levelConfigs.length > 0 && roleWeights.length > 0) {
    cache = { valeurs, expire: Date.now() + TTL_MS };
  }
  return valeurs;
}

/** Vide le cache. Appelé après un enregistrement pour ne pas servir l'ancien. */
export function oublierBareme(): void {
  cache = null;
}
