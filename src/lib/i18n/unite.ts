/**
 * Un nombre et son unité, tels qu'`Intl` les écrit dans la langue de qui lit.
 *
 * Les unités s'écrivaient à la main dans la couche d'affichage — « min », « s »,
 * « km », « kg », « cm », « h » — donc en français dans les six langues. Le
 * défaut se voit là où l'écriture change : « 2 min から » au milieu d'un écran
 * japonais, deux blocs sous un « 1分55秒 » que le même écran rend correctement.
 *
 * Aucune table n'est écrite ici, et c'est tout l'intérêt : `Intl` sait que le
 * chinois écrit « 2,4公里 » et « 2,4厘米 » là où le japonais garde « 2.4 km »
 * et « 2.4 cm », que l'allemand abrège les heures en « Std. » et les secondes
 * en « Sek. », et que l'anglais préfère « hr » à « h ». Une table écrite à la
 * main se tromperait sur chacun de ces points, et personne n'irait vérifier.
 *
 * Ce module vit à part de `duree.ts`, qui ne parle que de durées : le poids,
 * la taille et la distance n'ont rien à faire dans un module de cadran.
 */

/** Les unités que le produit affiche. */
export type UniteAffichee =
  | "minute" | "second" | "hour"
  | "kilometer" | "kilogram" | "centimeter";

/**
 * « 45 » et « second » → « 45 s » en français, « 45 Sek. » en allemand,
 * « 45秒 » en chinois.
 *
 * `decimales` borne la partie fractionnaire : zéro pour un compte de
 * répétitions ou de secondes, un pour une distance.
 */
export function uniteLocalisee(
  valeur: number,
  unit: UniteAffichee,
  etiquette: string,
  decimales = 0,
): string {
  return new Intl.NumberFormat(etiquette, {
    style: "unit", unit, unitDisplay: "short", maximumFractionDigits: decimales,
  }).format(valeur);
}
