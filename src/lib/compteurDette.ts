/**
 * Ce que la pastille de dette affiche, et quand elle prévient.
 *
 * Trois règles, sorties d'un composant de quatre cent vingt lignes. Elles ne
 * dépendent d'aucun état de React, et rien ne pouvait les atteindre là où
 * elles étaient — alors que ce sont elles qui disent combien il reste à faire,
 * c'est-à-dire la seule chose que ce compteur existe pour dire.
 */

/**
 * Horloge d'un décompte : « 4:32 ».
 *
 * Arrondi vers le HAUT, à la différence de la durée : un décompte qui affiche
 * « 0:00 » alors qu'il reste une demi-seconde ment sur ce qui reste, et c'est
 * la seconde où l'on relâche l'effort.
 */
export function horloge(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Durée lisible pour un libellé : « 5 min 20 ».
 *
 * Sous la minute, on donne des secondes : « 0 min 45 » se lit comme une
 * erreur d'affichage. Les secondes se posent sur deux chiffres, sinon
 * « 5 min 7 » se lit comme cinq minutes et sept minutes.
 */
export function duree(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const reste = s % 60;
  return reste === 0 ? `${m} min` : `${m} min ${String(reste).padStart(2, "0")}`;
}

/**
 * Y a-t-il de quoi faire une vraie séance ?
 *
 * Le compteur ne concerne que les exercices comptés en TEMPS : des pompes se
 * font dans la foulée de la partie, un round de boxe n'a d'intérêt qu'une fois
 * quelques minutes réunies. Un seuil à zéro veut dire « pas de seuil » et non
 * « préviens tout de suite » — sans cette distinction, un compte qui n'a rien
 * réglé recevrait une notification à la première seconde due.
 */
export function seuilFranchi(dette: { dureeSec: number; seuilSec: number } | null): boolean {
  return !!dette && dette.seuilSec > 0 && dette.dureeSec >= dette.seuilSec;
}
