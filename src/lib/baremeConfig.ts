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
   * Un barème INCOMPLET ne se met pas en cache, et pas seulement un barème
   * vide.
   *
   * Sur une base neuve, l'amorçage n'a pas encore eu lieu au premier appel :
   * garder ce vide pendant une minute ferait échouer tout ce qui calcule un
   * score, et le message serait « Config manquante » sur une base parfaitement
   * semée quelques millisecondes plus tard.
   *
   * **La maîtrise manquait à ce contrôle**, et c'est le même défaut que celui
   * déjà corrigé un fichier plus loin, dans `/api/games` : « un contrôle qui
   * en oublie un sur trois ne protège pas d'un tiers moins, il ne protège pas
   * du cas qui arrive ». Le semis écrit les trois tables l'une après l'autre ;
   * une lecture qui tombe ENTRE les paliers et la maîtrise voyait deux tables
   * pleines et la troisième nulle, et gelait cet état soixante secondes. Tout
   * enregistrement de partie rendait alors « Config manquante » pendant une
   * minute, sur une base pourtant semée.
   *
   * Le cas n'est pas théorique : il a rendu la CI rouge sur V495, sur le
   * premier test du premier tronçon, celui qui écrit sans avoir chargé
   * d'écran auparavant. Et trois lectures du barème ne sèment pas — la page du
   * tableau de bord, `/api/settings` et `/api/dashboard` — donc n'importe
   * laquelle peut ouvrir la fenêtre.
   */
  if (levelConfigs.length > 0 && roleWeights.length > 0 && masteryConfig) {
    cache = { valeurs, expire: Date.now() + TTL_MS };
  }
  return valeurs;
}

/** Vide le cache. Appelé après un enregistrement pour ne pas servir l'ancien. */
export function oublierBareme(): void {
  cache = null;
}
