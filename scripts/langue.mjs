/**
 * La langue des adresses mesurées.
 *
 * Depuis que la langue vit dans l'adresse, `/cgu` répond 308 vers `/fr/cgu` :
 * les trois scripts de mesure refusent de chronométrer une redirection, et se
 * seraient donc arrêtés net. Ils prennent maintenant une langue, le français
 * par défaut — c'est celle dans laquelle les textes sont écrits d'abord, donc
 * celle où un débordement se voit en premier.
 *
 * Passer `--langue=de` mesure l'allemand, qui est la langue où les mots sont
 * les plus longs : c'est là que la mise en page casse.
 */
export function langueDemandee(argv) {
  const drapeau = argv.find((a) => a.startsWith("--langue="));
  return drapeau ? drapeau.slice("--langue=".length) : "fr";
}

/** Le chemin d'une page dans cette langue. Les fichiers n'en prennent pas. */
export function enLangue(langue, chemin) {
  if (chemin.startsWith("/api/") || chemin.startsWith("/obs/")) return chemin;
  return chemin === "/" ? `/${langue}` : `/${langue}${chemin}`;
}

/**
 * Les arguments de POSITION, drapeaux écartés.
 *
 * Les quatre outils lisent leur adresse et leurs chemins par leur rang :
 * `process.argv[2]` est la base, `[3]` la page. Un `--langue=de` posé AVANT
 * l'adresse devenait donc l'adresse, et l'outil mesurait n'importe quoi — je
 * suis tombé deux fois dans ce piège, la seconde après l'avoir écrit au
 * journal. Le contrôle d'atterrissage ne peut pas le voir : il compare le
 * chemin d'arrivée au chemin transformé, c'est-à-dire à lui-même.
 *
 * Le rang se compte donc sur ce qui n'est pas un drapeau, et l'ordre des
 * arguments cesse d'être une source d'erreur.
 */
export function positionnels(argv) {
  return argv.slice(2).filter((a) => !a.startsWith("--"));
}

/**
 * Refuse un chemin qui porte DÉJÀ un préfixe de langue.
 *
 * `enLangue` pose le préfixe elle-même : `/fr/dashboard` devient donc
 * `/fr/fr/dashboard`, qui rend un 404. Le rapport est alors parfaitement
 * formé — de très bons chiffres sur « Cette adresse ne mène nulle part » — et
 * **le contrôle d'atterrissage ne peut pas le voir** : il compare le chemin
 * d'arrivée au chemin transformé, c'est-à-dire à lui-même.
 *
 * Je suis tombé dedans deux fois, la seconde après l'avoir écrit au journal.
 * Une leçon qu'on écrit sans la fermer se retombe dedans : elle se ferme donc
 * ici, à l'ENTRÉE, seul endroit où le défaut soit visible.
 */
export const LANGUES_MESURE = ["fr", "en", "es", "de", "zh", "ja"];

export function refuserPrefixe(chemin) {
  const premier = chemin.split("/")[1];
  if (LANGUES_MESURE.includes(premier)) {
    console.error(
      `Le chemin « ${chemin} » porte déjà un préfixe de langue. Les outils le`
      + ` posent eux-mêmes : passe « /${chemin.split("/").slice(2).join("/")} »`
      + ` et, si tu veux une autre langue, « --langue=${premier} ».`,
    );
    process.exit(1);
  }
  return chemin;
}
