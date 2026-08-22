import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Aucun écran ne doit choisir sa langue lui-même.
 *
 * On a trouvé, dans la confirmation de suppression de compte, un
 * `locale === "fr" ? … : …` écrit dans le composant : la phrase autour du mot
 * à taper existait en deux langues, et les quatre autres recevaient l'anglais
 * au milieu d'un écran traduit. Rien ne le signalait — les dictionnaires
 * étaient complets, les tests de parité verts, et le défaut ne se voyait qu'en
 * ouvrant la page dans une langue que personne ne relit.
 *
 * La règle est donc simple : le texte vit dans les dictionnaires, et un
 * composant ne compare jamais `locale` à une langue. Ce qui a besoin de la
 * langue elle-même — un format de date, une étiquette `Intl` — passe par les
 * fonctions prévues pour ça, qui la reçoivent sans la comparer.
 */

const RACINE = join(__dirname, "..", "..");
/** Le dossier i18n a le droit de connaître les langues : c'est son travail. */
const EXEMPT = join(RACINE, "lib", "i18n");

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (chemin.startsWith(EXEMPT)) continue;
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
    else if (/\.tsx?$/.test(entree) && !entree.endsWith(".test.ts")) out.push(chemin);
  }
  return out;
}

describe("la langue ne se décide pas dans les composants", () => {
  it("aucune comparaison de locale hors du dossier i18n", () => {
    // `locale === "fr"`, `locale !== "en"`, `lang == 'ja'` : toutes les formes
    // d'un même raccourci.
    const motif = /\b(locale|lang|langue)\s*[!=]==?\s*["'](fr|en|es|de|zh|ja)["']/;
    const fautifs: string[] = [];
    for (const chemin of fichiers(RACINE)) {
      const lignes = readFileSync(chemin, "utf8").split("\n");
      lignes.forEach((ligne, i) => {
        if (motif.test(ligne)) fautifs.push(`${chemin.slice(RACINE.length + 1)}:${i + 1}`);
      });
    }
    expect(fautifs).toEqual([]);
  });
});
