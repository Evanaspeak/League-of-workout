/**
 * Relancer quelqu'un qui n'est pas revenu.
 *
 * Une seule règle compte ici, et elle est de retenue : on ne relance qu'une
 * fois. Une application qui redit tous les jours « tu nous manques » se fait
 * couper, désinstaller, et elle l'a cherché. La date de la dernière relance
 * est donc une condition, pas un journal.
 */

/** Absence à partir de laquelle une relance a du sens. */
export const JOURS_ABSENCE = 14;

/** Délai avant de pouvoir relancer une seconde fois le même compte. */
export const JOURS_ENTRE_RELANCES = 90;

const JOUR_MS = 24 * 3600_000;

export type EtatRelance = {
  /** Dernière partie enregistrée, ou `null` si le compte n'en a aucune. */
  dernierePartie: Date | null;
  /** Dernière relance envoyée, ou `null`. */
  derniereRelance: Date | null;
};

/**
 * Faut-il relancer ce compte ?
 *
 * Un compte sans aucune partie n'est pas relancé : il n'est pas parti, il
 * n'est jamais arrivé. Lui dire « ça fait deux semaines » n'aurait aucun sens,
 * et c'est un autre problème — celui de la prise en main.
 */
export function relancer(etat: EtatRelance, maintenant: Date = new Date()): boolean {
  if (!etat.dernierePartie) return false;
  const absenceJours = (maintenant.getTime() - etat.dernierePartie.getTime()) / JOUR_MS;
  if (absenceJours < JOURS_ABSENCE) return false;
  if (!etat.derniereRelance) return true;
  const depuisRelance = (maintenant.getTime() - etat.derniereRelance.getTime()) / JOUR_MS;
  return depuisRelance >= JOURS_ENTRE_RELANCES;
}
