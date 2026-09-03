/**
 * Ce qui se passe quand l'application détecte qu'un jeu vient de démarrer.
 *
 * La session se lançait toute seule, sans le dire. Ce n'est pas une petite
 * chose : une session ouverte sonde Riot, chronomètre les jeux comptés au
 * temps, et décide donc de ce qui entrera dans la dette. La démarrer à la
 * place de quelqu'un est une surprise, et une surprise sur un compteur qui
 * fait faire des pompes.
 *
 * Trois conduites, et le défaut est de DEMANDER : l'écran de chargement est le
 * seul instant où l'on sait qu'une partie commence et où l'on n'est pas encore
 * en jeu.
 */
export const CONDUITES = ["demander", "auto", "jamais"] as const;
export type ConduiteSession = (typeof CONDUITES)[number];

export const CONDUITE_DEFAUT: ConduiteSession = "demander";

/** Normalise une valeur venue de la base ou d'un formulaire. */
export function toConduiteSession(v: unknown): ConduiteSession {
  return CONDUITES.includes(v as ConduiteSession) ? (v as ConduiteSession) : CONDUITE_DEFAUT;
}
