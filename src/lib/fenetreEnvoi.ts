/**
 * Quand un envoi programmé part, sur un déclencheur qui n'est pas ponctuel.
 *
 * Le rappel du matin, la relance et le bilan hebdomadaire cherchaient l'heure
 * EXACTE : `heureLocale(...) === 9`. Ça suppose un déclencheur qui passe toutes
 * les heures, ce que GitHub Actions ne garantit pas et ne fait pas. Relevé sur
 * huit jours : trente exécutions au lieu de cent quatre-vingt-douze, et
 * **aucune** à sept heures UTC — c'est-à-dire neuf heures en France. La
 * mécanique de rétention du produit n'a donc jamais tourné pour un compte
 * français, en répondant 200 à chaque passage.
 *
 * On ne cherche plus une heure, on cherche une FENÊTRE, et on retient ce qui
 * est déjà parti. Les deux moitiés sont nécessaires : sans fenêtre le
 * déclencheur rate la cible, sans marque de passage il enverrait à chaque
 * exécution de la matinée.
 *
 * La fenêtre s'arrête à midi. C'est encore le matin — le rappel garde son sens
 * — et ça laisse trois occasions au lieu d'une. L'élargir davantage ferait un
 * rappel « de la journée », ce qui n'est pas la même promesse.
 */

/** Première heure locale à laquelle un envoi du matin peut partir. */
export const DEBUT_MATIN = 9;

/** Première heure à laquelle il est trop tard : la fenêtre est [9, 12[. */
export const FIN_MATIN = 12;

/** Est-on dans la fenêtre du matin, chez cette personne ? */
export function dansLaFenetreDuMatin(heure: number | null): boolean {
  return heure !== null && heure >= DEBUT_MATIN && heure < FIN_MATIN;
}

/**
 * Est-ce le premier passage de la journée, chez cette personne ?
 *
 * La comparaison porte sur le JOUR LOCAL, pas sur un nombre d'heures écoulées.
 * « Vingt-quatre heures depuis le dernier envoi » laisserait la marque dériver
 * d'un jour à l'autre : envoyé à 11 h 30 lundi, le prochain ne pourrait pas
 * partir avant 11 h 30 mardi, donc sortirait de la fenêtre au bout de quelques
 * jours et l'envoi sauterait une journée sur deux.
 */
export function dejaEnvoyeAujourdhui(
  dernier: Date | null | undefined,
  maintenant: Date,
  jourDe: (d: Date) => string,
): boolean {
  return !!dernier && jourDe(dernier) === jourDe(maintenant);
}
