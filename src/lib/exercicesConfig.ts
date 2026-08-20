import { prisma } from "@/lib/prisma";
import {
  appliquerRatios, normaliserRatios, RATIOS_DEFAUT, type RatiosExercices,
} from "@/lib/exercices";

/** Clé de la table SystemConfig où vivent les ratios. */
export const CLE_RATIOS = "exercices";

/**
 * Durée de vie du cache mémoire.
 *
 * Sans lui, chaque page et chaque appel d'API paierait un aller-retour vers
 * la base pour trois nombres qui changent une fois par mois. Avec lui, une
 * modification met au pire une minute à se propager sur l'ensemble des
 * instances — l'instance qui reçoit l'enregistrement, elle, vide son cache
 * tout de suite et le voit immédiatement.
 */
const TTL_MS = 60_000;

let cache: { valeurs: RatiosExercices; expire: number } | null = null;

/**
 * Charge les ratios et les installe pour le processus courant.
 *
 * À appeler au début de tout rendu ou de toute route qui convertit des points
 * en répétitions. Ne jette jamais : une base injoignable ou une table absente
 * doit donner les ratios d'origine, pas une page en erreur.
 */
export async function chargerRatios(): Promise<RatiosExercices> {
  if (cache && Date.now() < cache.expire) return appliquerRatios(cache.valeurs);

  let valeurs: RatiosExercices = { ...RATIOS_DEFAUT };
  try {
    const ligne = await prisma.systemConfig.findUnique({ where: { key: CLE_RATIOS } });
    if (ligne) valeurs = normaliserRatios(JSON.parse(ligne.value));
  } catch {
    // Table absente, base injoignable ou JSON illisible : on garde les défauts.
  }

  cache = { valeurs, expire: Date.now() + TTL_MS };
  return appliquerRatios(valeurs);
}

/** Vide le cache. Appelé après un enregistrement pour ne pas servir l'ancien. */
export function oublierRatios(): void {
  cache = null;
}
