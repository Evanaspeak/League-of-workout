/**
 * Ce qu'une partie peut raisonnablement contenir.
 *
 * Sans bornes, une faute de frappe se paie très cher et ne se rattrape pas :
 * `999999999` secondes de Minecraft au lieu de `999` produisait **5 555 556
 * points de dette** en une requête. Ce n'est pas un abus, c'est un zéro de
 * trop dans un champ — et la personne se retrouve avec une dette qu'elle ne
 * pourra jamais payer, sur un produit dont c'est précisément le sujet.
 *
 * Les valeurs sont larges à dessein : il s'agit d'attraper l'impossible, pas
 * de discuter l'exploit. Trente-six heures de jeu d'affilée sont acceptées ;
 * onze jours ne le sont pas.
 */

/** Une session au temps, en secondes. Trente-six heures. */
export const DUREE_MAX_SEC = 36 * 3600;

/**
 * Éliminations, morts, assistances.
 *
 * Le record connu sur une partie de League tourne autour de la centaine ;
 * mille laisse toute la place aux modes délirants et aux parties de six
 * heures, et refuse le milliard.
 */
export const KDA_MAX = 1000;

/** Nombre de joueurs d'un battle royale. */
export const JOUEURS_MAX = 500;

/**
 * Un nombre entier, dans ses bornes, ou `null`.
 *
 * Rend `null` — et non zéro — pour ce qui n'est pas un nombre fini : `NaN`,
 * `Infinity`, `1e308`, une chaîne, un objet. Le repli sur zéro qui existait
 * avant confondait « absent » et « aberrant », et laissait passer `1e308`
 * jusqu'à la base, qui répondait par une erreur 500 sans rien expliquer.
 */
export function entierBorne(valeur: unknown, max: number, min = 0): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  // `Number([])` vaut zéro, `Number({})` vaut `NaN` : la conversion implicite
  // de JavaScript accepte des choses qui ne sont pas des nombres et en tire
  // parfois un chiffre. On ne convertit que ce qui prétend en être un.
  if (typeof valeur !== "number" && typeof valeur !== "string") return null;
  const n = Number(valeur);
  if (!Number.isFinite(n)) return null;
  const arrondi = Math.round(n);
  if (arrondi < min || arrondi > max) return null;
  return arrondi;
}
