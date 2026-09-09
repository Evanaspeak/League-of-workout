import {
  ECARTS, PLANCHERS, imc, metabolismeBase,
  type Mesures, type ModeCalorique, type Objectif,
} from "./objectifCalorique";

/**
 * Ce qu'une montre a MESURÉ dans la journée, et ce que ça change.
 *
 * Réponse 040 : « Oui, commence par ça — un champ quotidien qu'on remplit
 * depuis sa montre. » Réponse 041 : « Elle nourrit l'objectif », et non « elle
 * reste un simple journal ». Les deux ensemble décident de tout ce qui suit.
 *
 * ## Ce que la valeur DÉSIGNE, et le piège qu'il faut fermer
 *
 * `objectifCalorique` part d'une ESTIMATION : le métabolisme de base multiplié
 * par un facteur d'activité choisi dans une liste. Une montre, elle, MESURE.
 * Quand la mesure existe, elle remplace l'estimation pour ce jour-là — c'est
 * exactement ce que « nourrit l'objectif » veut dire, et c'est la seule
 * lecture qui fasse autre chose qu'un journal.
 *
 * Mais une montre affiche DEUX chiffres, et ils diffèrent d'un facteur trois :
 * les calories ACTIVES (ce que l'exercice a coûté, six cents un bon jour) et
 * la dépense TOTALE de la journée (deux mille quatre cents, métabolisme de
 * base compris). Prendre les premières pour la seconde diviserait l'objectif
 * par trois, et ce serait un conseil dangereux rendu par un chiffre qui a
 * l'air d'un résultat.
 *
 * C'est le piège de `totalPoints` contre `pointsPayes`, sur une grandeur qui
 * touche à la santé. Deux choses le ferment, et il faut les deux :
 *
 *  - **le NOM le dit** — `kcalBrulees` désigne la dépense de la journée
 *    entière, et le libellé de l'écran le répète en toutes lettres ;
 *  - **le plancher est PHYSIOLOGIQUE** : un corps dépense son métabolisme de
 *    base rien qu'en restant couché. Une dépense totale inférieure à lui est
 *    donc impossible, et c'est précisément la forme que prend la confusion.
 *    Le refus DIT laquelle des deux valeurs on attend, au lieu de dire
 *    « valeur invalide ».
 */

/**
 * Les bornes du plausible, en kilocalories par jour.
 *
 * Le plancher n'est pas ici : il se déduit du profil, et vaut le métabolisme
 * de base. Celui-ci ne sert qu'à qui n'a pas encore rempli ses mesures — mille
 * kilocalories est en dessous du métabolisme de tout adulte, donc il ne
 * refuse rien de légitime, et il attrape quand même un zéro de trop.
 *
 * Le plafond couvre une étape du Tour de France, qui est la dépense
 * quotidienne la plus haute jamais mesurée sur un humain. Sans lui, une frappe
 * de trop écraserait l'échelle du graphique pour toujours.
 */
export const KCAL_MIN_SANS_PROFIL = 1_000;
export const KCAL_MAX = 12_000;

export type VerdictDepense = "ok" | "trop-bas" | "sous-le-metabolisme" | "trop-haut";

/**
 * La valeur est-elle une dépense de JOURNÉE ?
 *
 * Trois refus distincts, parce qu'ils ne se corrigent pas de la même façon :
 * un chiffre absurde se retape, une valeur sous le métabolisme de base est
 * presque toujours les calories ACTIVES à la place du total, et le message
 * doit le dire.
 */
export function verdictDepense(
  kcal: number,
  mesures: Mesures | null,
): VerdictDepense {
  // L'infini n'est pas une valeur illisible, c'est une valeur trop haute :
  // `Number("1e999")` le rend, et le refus doit dire dans quel sens.
  if (!Number.isFinite(kcal)) {
    return kcal === Number.POSITIVE_INFINITY ? "trop-haut" : "trop-bas";
  }
  if (kcal > KCAL_MAX) return "trop-haut";

  /**
   * Le contrôle du métabolisme passe AVANT le plancher générique, et l'ordre
   * est la décision.
   *
   * Six cents kilocalories est à la fois « en dessous de mille » et « en
   * dessous du métabolisme de base » — donc les deux refus s'appliquent, et
   * c'est le plus PRÉCIS qui doit parler. « Valeur trop basse » enverrait
   * retaper le même chiffre ; « la dépense de la journée entière » dit lequel
   * des deux chiffres de la montre on attend.
   */
  if (mesures && kcal < metabolismeBase(mesures)) return "sous-le-metabolisme";
  if (kcal < KCAL_MIN_SANS_PROFIL) return "trop-bas";
  return "ok";
}

/**
 * L'objectif du jour, la dépense estimée remplacée par la dépense mesurée.
 *
 * Les deux avertissements suivent la valeur qu'on affiche, et pas
 * l'estimation : c'est ce chiffre-là qu'on va manger. Un objectif recalculé
 * sur une petite journée peut passer sous le plancher de la réponse 017 alors
 * que l'estimation ne le franchissait pas — et c'est exactement le moment où
 * l'avertissement sert.
 *
 * Aucune date, aucune échéance, comme partout dans ce module : réponse 016.
 */
export function objectifMesure(
  m: Mesures,
  mode: ModeCalorique,
  kcalBrulees: number,
): Objectif {
  const cible = Math.round(kcalBrulees * (1 + ECARTS[mode]));
  const indice = imc(m.poids, m.taille);
  return {
    maintien: Math.round(kcalBrulees),
    cible,
    mode,
    imc: indice,
    sousPlancher: cible < PLANCHERS[m.formule],
    imcBas: indice !== null && indice < 18.5,
  };
}
