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

/**
 * L'HEURE DU JOUR sur un axe de graphique : « 14 h » en français, « 2 PM » en
 * anglais, « 14 Uhr » en allemand, « 14時 » en japonais, « 14 » en espagnol.
 *
 * Elle vivait dans DEUX routes d'API sous la forme `` `${h}h` ``, donc en
 * français dans les six langues — et le commentaire posé juste au-dessus
 * expliquait déjà pourquoi les jours et les mois n'y sont plus : « le serveur
 * envoie leur numéro, et le navigateur les nomme dans la langue du lecteur ».
 * La règle était écrite ; l'heure ne l'avait pas suivie. C'est la moitié non
 * réparée d'une correction déjà faite, motif que ce projet paie en boucle.
 *
 * `hour12` n'est pas imposé : l'anglais rend « 2 PM » et le français « 14 h »
 * parce que c'est ce que chaque langue fait, et une table écrite à la main
 * aurait rendu « 14h » aux deux.
 */
export function heureDuJourLocalisee(heure: number, etiquette: string): string {
  return new Intl.DateTimeFormat(etiquette, { hour: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(1970, 0, 4, heure)));
}
