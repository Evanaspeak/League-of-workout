// Quelle langue parle l'application de bureau.
//
// Le site sait la sienne : elle est rangée dans le stockage du navigateur
// (`low_locale`) et sur le compte. La coquille Electron, elle, écrivait tout
// en français : les trois écrans de connexion, le menu près de l'horloge, les
// notifications de capture. Quelqu'un qui lit l'application en allemand
// recevait donc du français au premier écran de l'application installée, et
// dans le seul menu qui reste visible quand la fenêtre est fermée.
//
// C'est la même situation que les notifications web et l'image de bilan : du
// texte qui part hors d'un composant React, donc hors de `useT`. Et la même
// réponse : la langue voyage, les textes vivent à part.

/** Les six langues de l'application, dans l'ordre où elles sont apparues. */
const LANGUES = ["fr", "en", "es", "de", "zh", "ja"];

/** Celle qu'on parle quand on ne sait pas. Jamais du vide, jamais du français. */
const REPLI = "en";

/**
 * Choisit une langue parmi des candidats, du plus sûr au moins sûr.
 *
 * Chaque candidat peut être une étiquette complète (« fr-FR », « zh-Hans-CN »)
 * ou nulle. On lit la sous-étiquette de langue, ce qui est la seule partie qui
 * nous intéresse : on ne distingue pas le portugais du Brésil du portugais tout
 * court, on ne le parle ni l'un ni l'autre.
 *
 * @param {...(string|null|undefined)} candidats
 * @returns {string} une des six langues, jamais autre chose.
 */
function choisirLangue(...candidats) {
  for (const brut of candidats) {
    if (typeof brut !== "string") continue;
    // `zh-Hans` et `zh_CN` s'écrivent des deux façons selon la source.
    const code = brut.trim().toLowerCase().split(/[-_]/)[0];
    if (LANGUES.includes(code)) return code;
  }
  return REPLI;
}

module.exports = { LANGUES, REPLI, choisirLangue };
