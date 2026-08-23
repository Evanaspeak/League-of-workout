/**
 * Rappel d'échauffement avant une grosse séance.
 *
 * Un simple rappel, et rien d'autre : pas d'écran à traverser, pas de minuteur
 * à lancer, pas de série imposée. Une phrase à l'endroit et au moment où
 * quelqu'un s'apprête à faire l'effort, qui n'empêche personne de commencer
 * tout de suite. Une étape obligatoire aurait fait fermer la fenêtre.
 */

/**
 * Au-delà de cette durée d'effort, la phrase s'affiche. Cinq minutes : en
 * dessous, on est dans les quelques dizaines de secondes qui suivent une
 * partie, et prévenir à chaque fois reviendrait à ne plus jamais être lu.
 */
export const SEUIL_ECHAUFFEMENT_SEC = 300;

/** La séance mérite-t-elle un mot sur l'échauffement ? */
export function echauffementConseille(dureeSec: number): boolean {
  return Number.isFinite(dureeSec) && dureeSec >= SEUIL_ECHAUFFEMENT_SEC;
}
