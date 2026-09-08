import {
  EXERCICE_IDS, repartirPoints, secondesParPoint, toExerciceIds, type PartsExercices,
  type RatiosExercices,
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
 * est l'exercice le plus dépensier des trois — le shadow, qui n'a ni impact ni
 * résistance, se range juste en dessous.
 */
export const MET: Record<ExerciceId, number> = {
  pompes: 8.0,
  squats: 5.5,
  boxe: 7.8,
  // Le gainage est isométrique : soutenu, mais sans déplacement de masse.
  planche: 4.0,
  // L'exercice au poids du corps le plus coûteux du lot.
  tractions: 8.0,
  // Course à allure d'entretien, autour de dix kilomètres à l'heure.
  course: 9.8,
  // Gymnastique au poids du corps à effort LÉGER : debout, on ne pousse
  // qu'une fraction de son poids. C'est la ligne du Compendium qui décrit
  // vraiment le mouvement, et non celle des pompes au sol.
  pompesMurales: 3.5,
  // Marche à cinq kilomètres à l'heure sur terrain plat.
  marche: 3.5,
  // Boxe sans sac : le mouvement et le rythme sont ceux du sac, l'impact et
  // la résistance n'y sont pas. La ligne du Compendium qui décrit vraiment
  // ça est en dessous de celle du sac, et c'est le bon sens de l'écart.
  shadow: 6.5,
  // Fentes : même registre que les squats, avec la composante d'équilibre en
  // plus.
  fentes: 5.5,
  // Chaise contre un mur : isométrique, comme la planche.
  chaise: 4.0,
  // La ligne « abdominaux, effort modéré » du Compendium.
  abdos: 3.8,
  // Le gainage latéral est isométrique lui aussi : la même valeur que la
  // planche, dont il ne diffère que par l'angle.
  gainageLateral: 4.0,
  // Gymnastique au poids du corps à effort VIGOUREUX : le burpees enchaîne
  // une flexion, une planche et un saut.
  burpees: 8.0,
  // Corde à sauter à cadence tenue, pas à celle d'une compétition — le
  // Compendium monte à 11,8 pour un rythme soutenu.
  corde: 10.0,
  // Poussée au poids du corps, comme les pompes et les tractions.
  dips: 8.0,
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
  // Un gainage se tient sans pause : tout le temps compté est du temps sous
  // tension.
  planche: 1,
  // Vingt secondes par traction, repos compris, dont six de travail réel.
  // Cela met la traction autour d'une kilocalorie pièce à 70 kg, ce que
  // donne la littérature.
  tractions: 0.3,
  // On ne s'arrête pas en courant.
  course: 1,
  // Quatre secondes par répétition, dont environ deux et demie de poussée :
  // le mouvement est court et demande moins de récupération qu'au sol.
  pompesMurales: 0.6,
  // On ne s'arrête pas en marchant non plus.
  marche: 1,
  // On ne s'arrête pas en shadow non plus : comme le sac, il se compte en
  // temps de travail effectif, donc il n'y a rien à retrancher.
  shadow: 1,
  // Six secondes par fente, repos compris : la moitié est du mouvement, comme
  // pour les squats.
  fentes: 0.5,
  // Une chaise se tient sans pause : tout le temps compté est sous tension.
  chaise: 1,
  // Trois secondes par abdo, dont environ la moitié de contraction.
  abdos: 0.5,
  // Un gainage latéral se tient sans pause, comme la planche.
  gainageLateral: 1,
  // Dix secondes par burpee, dont six de mouvement réel : c'est le plus long
  // du catalogue, et il laisse le temps de souffler entre deux.
  burpees: 0.6,
  // On ne s'arrête pas à la corde.
  corde: 1,
  // Douze secondes par dip, repos compris, dont quatre de poussée : entre la
  // pompe et la traction, comme le reste de ses réglages.
  dips: 0.35,
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

/**
 * Énergie d'une ventilation déjà faite, en kilocalories.
 *
 * Les ratios sont OPTIONNELS et se propagent jusqu'à `secondesParPoint` : un
 * point d'effort ne vaut pas le même temps de travail selon le barème, et une
 * énergie calculée sous le barème de quelqu'un d'autre serait fausse dans les
 * deux sens.
 */
export function caloriesDeRepartition(
  repartition: Repartition,
  poids: number | null | undefined,
  ratios?: RatiosExercices | null,
): number {
  const kg = poidsRetenu(poids);
  let kcal = 0;
  for (const id of EXERCICE_IDS) {
    const points = repartition[id] ?? 0;
    if (points <= 0) continue;
    const heures = (points * secondesParPoint(id, ratios) * PART_A_L_EFFORT[id]) / 3600;
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
  points: number,
  exercices: ExerciceId[],
  /** Des KILOGRAMMES. `parts`, juste en dessous, est autre chose. */
  poids: number | null | undefined,
  /** Le poids de chaque exercice dans le partage (réponse 068). */
  parts?: PartsExercices | null,
  /** Le barème du compte (réponse 047). Absent : celui du module. */
  ratios?: RatiosExercices | null,
): number {
  const liste = toExerciceIds(exercices);
  return caloriesDeRepartition(
    repartirPoints(Math.max(0, points), liste, parts), poids, ratios,
  );
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
