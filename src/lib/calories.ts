import {
  EXERCICE_IDS, repartirPoints, secondesParPoint, toExerciceIds,
  type ExerciceId, type Repartition,
} from "@/lib/exercices";

/**
 * L'énergie dépensée, à partir de ce qui est déjà enregistré.
 *
 * Aucune donnée nouvelle n'est collectée : les points d'effort existent depuis
 * le premier jour, et la conversion est publique. C'est ce qui rend ce calcul
 * acceptable là où la plupart des estimations de calories demandent d'abord un
 * profil complet.
 *
 * La méthode est celle du MET — l'équivalent métabolique. L'énergie dépensée
 * vaut MET × poids en kilogrammes × durée en heures. C'est une approximation
 * grossière, et elle est présentée comme telle : deux personnes du même poids
 * qui font les mêmes pompes ne dépensent pas la même chose.
 */

/**
 * Valeurs du Compendium of Physical Activities, dans leur usage courant.
 *
 * Les pompes relèvent de la gymnastique au poids du corps menée avec effort ;
 * les squats, du même registre mais moins coûteux à la minute ; la boxe au sac
 * est l'exercice le plus dépensier des trois.
 */
export const MET: Record<ExerciceId, number> = {
  pompes: 8.0,
  squats: 5.5,
  boxe: 7.8,
};

/**
 * Part du temps réellement passée à l'effort.
 *
 * C'est la correction qui manquait à la première version, et elle change le
 * résultat du simple au double. L'application compte six secondes par pompe :
 * c'est le temps qu'elle prend en tout, récupération comprise. Appliquer un MET
 * de 8 à ces six secondes revient à dire qu'on est à l'effort maximal pendant
 * la pause, et rendait presque une kilocalorie par pompe — le double de ce que
 * mesure la littérature.
 *
 * La boxe, elle, se compte en temps de travail effectif : rien à retrancher.
 */
export const PART_A_L_EFFORT: Record<ExerciceId, number> = {
  pompes: 0.42,
  squats: 0.5,
  boxe: 1,
};

/**
 * Poids retenu quand on ne le connaît pas.
 *
 * Il est affiché avec le chiffre : une estimation dont on cache l'hypothèse
 * n'est pas une estimation, c'est une affirmation. Et le poids relève de
 * l'article 9 du RGPD — beaucoup de comptes n'auront jamais consenti à le
 * donner, ce qui est leur droit et ne doit pas les priver du chiffre.
 */
export const POIDS_PAR_DEFAUT = 70;

/** Bornes du poids retenu : au-delà, ce n'est plus une estimation. */
const POIDS_MIN = 30;
const POIDS_MAX = 300;

export function poidsRetenu(poids: number | null | undefined): number {
  const p = Number(poids);
  if (!Number.isFinite(p) || p < POIDS_MIN || p > POIDS_MAX) return POIDS_PAR_DEFAUT;
  return p;
}

/** Énergie d'une ventilation déjà faite, en kilocalories. */
export function caloriesDeRepartition(
  repartition: Repartition, poids: number | null | undefined,
): number {
  const kg = poidsRetenu(poids);
  let kcal = 0;
  for (const id of EXERCICE_IDS) {
    const points = repartition[id] ?? 0;
    if (points <= 0) continue;
    const heures = (points * secondesParPoint(id) * PART_A_L_EFFORT[id]) / 3600;
    kcal += MET[id] * kg * heures;
  }
  return Math.round(kcal);
}

/**
 * Énergie d'un total de points, partagé entre les exercices choisis.
 *
 * Le partage passe par la même fonction que la dette : un chiffre de calories
 * qui reposerait sur un autre partage que celui réellement fait annoncerait
 * l'énergie d'un effort que personne n'a produit.
 */
export function caloriesDePoints(
  points: number, exercices: ExerciceId[], poids: number | null | undefined,
): number {
  const liste = toExerciceIds(exercices);
  return caloriesDeRepartition(repartirPoints(Math.max(0, points), liste), poids);
}

/**
 * Une équivalence en marche, pas en nourriture.
 *
 * L'usage veut qu'on traduise les calories en carrés de chocolat. Sur une
 * application qui impose de l'effort après une défaite, mettre un aliment en
 * face d'une punition installe un rapport dont on ne maîtrise pas la suite.
 * La marche dit la même chose sans rien mettre dans l'assiette de personne.
 */
export function minutesDeMarche(kcal: number, poids: number | null | undefined): number {
  // Marche à allure modérée : 3,5 MET.
  const parMinute = (3.5 * poidsRetenu(poids)) / 60;
  if (parMinute <= 0) return 0;
  return Math.round(Math.max(0, kcal) / parMinute);
}
