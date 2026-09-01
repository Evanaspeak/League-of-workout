/**
 * Le chemin d'une adresse, sans son préfixe de langue.
 *
 * Depuis que la langue vit dans l'adresse, `/login` s'écrit `/fr/login`. Les
 * parcours qui attendaient de « quitter la connexion » demandaient
 * `!pathname.startsWith("/login")` : avec le préfixe, cette condition est vraie
 * DÈS la page de connexion, et l'attente se résolvait tout de suite, sur la
 * page qu'on voulait justement quitter. Les tests suivants échouaient alors
 * pour une raison qui ne ressemble pas à sa cause.
 *
 * La liste est recopiée depuis `src/lib/i18n/langues.ts`. Ce fichier-ci sert
 * à des tests de bout en bout qui ne compilent pas le paquet du site ; le
 * recensement des dictionnaires refuserait de toute façon une septième langue
 * qui ne serait pas partout.
 */
const LANGUES = ["fr", "en", "es", "de", "zh", "ja"];

export function sansLangue(chemin: string): string {
  const segments = chemin.split("/");
  if (!LANGUES.includes(segments[1])) return chemin;
  const reste = `/${segments.slice(2).join("/")}`;
  return reste === "/" ? "/" : reste;
}

/** L'adresse d'une page dans une langue donnée. */
export function enLangue(langue: string, chemin: string): string {
  return chemin === "/" ? `/${langue}` : `/${langue}${chemin}`;
}
