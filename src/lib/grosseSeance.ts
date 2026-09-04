/**
 * Ce qui fait qu'une séance mérite d'être montrée.
 *
 * Réponse 122 : « une image de partage générée automatiquement après une
 * grosse séance ». Reste à dire ce qu'est une GROSSE séance, et la réponse ne
 * peut pas être un nombre fixe : cent points sont une soirée ordinaire pour
 * quelqu'un qui joue beaucoup et un record pour quelqu'un qui débute.
 *
 * C'est donc un RECORD sur une fenêtre glissante — la plus grosse séance des
 * trente derniers jours. Deux raisons :
 *
 * - **ça se rejoue.** Un record de toujours est décidé par une seule soirée,
 *   et plus personne ne le bat ; c'est le défaut déjà écrit pour le classement
 *   cumulatif, qui a fait choisir sept jours glissants ;
 * - **ça reste rare.** Une image proposée à chaque paiement n'est plus une
 *   fierté, c'est une sollicitation — et on finit par ne plus la voir.
 *
 * Avec un PLANCHER, parce qu'un record ne veut rien dire quand il n'y a rien à
 * battre : la toute première séance est toujours un record, et proposer de
 * partager quatre pompes met le produit en défaut de sérieux.
 */

/** La fenêtre sur laquelle on cherche le record. */
export const FENETRE_JOURS = 30;

/**
 * En dessous, on ne propose rien.
 *
 * Cent points, c'est l'ordre de grandeur d'une soirée qui a coûté quelque
 * chose. Un chiffre plus bas ferait proposer l'image presque à chaque fois,
 * ce qui la viderait de son sens ; plus haut, la plupart des gens ne la
 * verraient jamais.
 */
export const PLANCHER_POINTS = 100;

/**
 * Cette séance-ci est-elle la plus grosse de la fenêtre ?
 *
 * `precedents` porte les points des paiements de la fenêtre, celui qu'on
 * examine EXCLU. Un ex æquo ne compte pas : égaler son record n'est pas le
 * battre, et proposer deux fois la même image pour le même chiffre est
 * exactement la sollicitation qu'on veut éviter.
 */
export function estGrosseSeance(points: number, precedents: number[]): boolean {
  if (!Number.isFinite(points) || points < PLANCHER_POINTS) return false;
  return precedents.every((p) => points > p);
}
