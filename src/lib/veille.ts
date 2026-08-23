/**
 * La veille de volume.
 *
 * L'application réclame de l'effort après une défaite. Elle peut donc servir à
 * se punir, et rien ne l'en empêche : le plafond quotidien existe, mais c'est
 * la personne qui le règle, et quelqu'un qui se punit ne le règle pas.
 *
 * Ce qui suit ne bloque rien. Le choix a été fait de laisser chacun libre de
 * continuer — ce qui suppose de dire ce qu'on voit, une fois, sans y revenir.
 *
 * Les seuils ne sont pas des recommandations médicales et ne prétendent pas
 * l'être. Ils marquent le moment où le volume cesse d'être ordinaire pour de
 * l'exercice au poids du corps, et où le signaler vaut mieux que se taire.
 */

/** Environ deux heures d'effort dans la journée. */
export const SEUIL_JOUR = 1200;

/** Environ huit heures d'effort sur sept jours glissants. */
export const SEUIL_SEMAINE = 5000;

export type Veille = {
  pointsJour: number;
  pointsSemaine: number;
  /** Ce qui a été franchi, s'il y a lieu. */
  alerte: "jour" | "semaine" | null;
};

/**
 * Regarde le volume, et dit s'il y a lieu d'en parler.
 *
 * Le jour l'emporte sur la semaine : c'est le signal le plus immédiat, et
 * annoncer les deux à la fois transformerait un constat en réquisitoire.
 */
export function veiller(pointsJour: number, pointsSemaine: number): Veille {
  const jour = Math.max(0, Math.round(pointsJour));
  const semaine = Math.max(0, Math.round(pointsSemaine));
  return {
    pointsJour: jour,
    pointsSemaine: semaine,
    alerte: jour >= SEUIL_JOUR ? "jour" : semaine >= SEUIL_SEMAINE ? "semaine" : null,
  };
}

/**
 * Points générés sur une fenêtre glissante, à partir des parties.
 *
 * Glissante et non calendaire : quelqu'un qui joue du vendredi au dimanche ne
 * doit pas voir son total remis à zéro le lundi matin, au moment précis où il
 * serait utile de le regarder.
 */
export function pointsSur(
  parties: { date: Date; pompesCalculees: number }[],
  jours: number,
  maintenant: Date = new Date(),
): number {
  const depuis = maintenant.getTime() - jours * 86_400_000;
  return parties.reduce(
    (total, p) => (p.date.getTime() >= depuis ? total + Math.max(0, p.pompesCalculees) : total),
    0,
  );
}
