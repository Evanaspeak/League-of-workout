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
