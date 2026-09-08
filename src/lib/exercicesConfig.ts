import { prisma } from "@/lib/prisma";
import {
  appliquerRatios, fusionnerRatios, normaliserRatios, RATIOS_DEFAUT,
  type RatiosExercices,
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
 * Le barème GLOBAL, sans l'installer sur le module.
 *
 * C'est la moitié qui compte depuis que les ratios peuvent être personnels
 * (réponse 047) : `appliquerRatios` pose les valeurs sur un objet de MODULE,
 * partagé par toutes les requêtes du processus. Installer là un barème de
 * compte ferait convertir la dette de l'un avec les ratios de l'autre, sans
 * erreur et sans rien qui le signale.
 *
 * Ne jette jamais : une base injoignable ou une table absente doit donner les
 * ratios d'origine, pas une page en erreur.
 */
async function ratiosGlobaux(): Promise<RatiosExercices> {
  if (cache && Date.now() < cache.expire) return cache.valeurs;

  let valeurs: RatiosExercices = { ...RATIOS_DEFAUT };
  try {
    const ligne = await prisma.systemConfig.findUnique({ where: { key: CLE_RATIOS } });
    if (ligne) valeurs = normaliserRatios(JSON.parse(ligne.value));
  } catch {
    // Table absente, base injoignable ou JSON illisible : on garde les défauts.
  }

  cache = { valeurs, expire: Date.now() + TTL_MS };
  return valeurs;
}

/**
 * Charge les ratios GLOBAUX et les installe pour le processus courant.
 *
 * À appeler au début de tout rendu ou de toute route qui convertit des points
 * en répétitions SANS savoir de quel compte il s'agit — la mise en page
 * racine, une page publique, la source de diffusion.
 *
 * Ce qu'elle installe est le barème commun, jamais celui d'un compte : un
 * appelant qui oublierait de passer les ratios personnels retombe donc sur le
 * global, ce qui est le comportement d'avant. C'est cette propriété qui rend
 * la reprise des appelants sûre un par un.
 */
export async function chargerRatios(): Promise<RatiosExercices> {
  return appliquerRatios(await ratiosGlobaux());
}

/**
 * Le barème d'un COMPTE : le global, corrigé de ce que la personne a réglé.
 *
 * Il ne s'installe PAS sur le module — voir `ratiosGlobaux` — et se passe donc
 * explicitement aux conversions. C'est plus verbeux, et c'est la seule forme
 * qui tienne sur un serveur qui répond à plusieurs personnes à la fois.
 */
export async function ratiosPourCompte(perso: unknown): Promise<RatiosExercices> {
  return fusionnerRatios(await ratiosGlobaux(), perso);
}

/** Vide le cache. Appelé après un enregistrement pour ne pas servir l'ancien. */
export function oublierRatios(): void {
  cache = null;
}
