import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RACINE_I18N, fichiersLangue } from "@/test/fichiersLangue";

/**
 * Le pluriel de ZÉRO, et la règle française appliquée aux cinq autres langues.
 *
 * Trouvé en lisant le tableau de bord en allemand : « 0 Person hat diesen
 * Monat beigetragen ». L'allemand met le PLURIEL à zéro — « 0 Personen
 * haben » — comme l'anglais et l'espagnol. Le français est la seule des trois
 * à mettre le singulier : « 0 personne a contribué ».
 *
 * Les gabarits s'écrivaient tous `n > 1 ? pluriel : singulier`, ce qui est
 * juste en français et faux ailleurs. Trente gabarits dans cinq fichiers, tous
 * recopiés depuis le bloc français.
 *
 * Ce n'est pas un cas de bord : l'objectif collectif se remet à zéro le
 * premier du mois, donc TOUT LE MONDE lit ce chiffre à zéro ce jour-là. Et
 * rien ne pouvait le signaler — les six blocs ont les mêmes clés, les mêmes
 * natures de valeur, et rendent tous une chaîne.
 *
 * La condition juste hors du français est `n !== 1`. Le français garde
 * `n > 1`, et c'est écrit ici pour qu'on ne le « corrige » pas.
 *
 * **La portée est `src/lib/i18n` ENTIER**, sous-dossiers compris. Elle a été
 * bornée à `dictionaries/` jusqu'au 10 septembre, alors que quinze modules
 * porteurs de texte vivent un dossier au-dessus — c'est le trou qui a laissé
 * « Cette activité n'a pas de résultat » et deux descriptions Google qui
 * vouvoient. Le crible manuel des quinze est NÉGATIF, aucun n'écrit de
 * gabarit à seuil aujourd'hui : ce qu'on ferme ici est le fichier qu'on
 * ajoutera demain.
 */

/** Les blocs de langue, à N'IMPORTE QUELLE indentation. */
function blocs(source: string): { langue: string; debut: number }[] {
  return [...source.matchAll(/\n +(fr|en|es|de|zh|ja):\s*\{/g)].map((m) => ({
    langue: m[1],
    debut: m.index ?? 0,
  }));
}

/**
 * La seconde forme, et elle n'a AUCUN bloc de langue.
 *
 * `apiErrors.ts` range ses traductions par clé — et la clé EST le message
 * français, puisque c'est lui qui circule sur le réseau. Un gabarit à seuil y
 * vivrait donc forcément dans une valeur NON française : le compter comme
 * fautif est le bon sens de l'erreur.
 */
function clesTraduites(source: string): number {
  return [...source.matchAll(/^ {2}"(?:[^"\\]|\\.)*":\s*\{/gm)].length;
}

/**
 * Ce qui est jugé, et ce qui ne l'est pas.
 *
 * Un `> 1 ?` dans `cheminLocalise.ts` ou `useChemin.ts` est du code ordinaire
 * — un compte de segments, une longueur — et crier dessus ferait un faux
 * positif sur du code juste. Seuls les fichiers qui PORTENT du texte par
 * langue sont dans le champ, sous l'une ou l'autre des deux formes.
 */
function porteDuTexte(source: string): boolean {
  return blocs(source).length >= 2 || clesTraduites(source) >= 5;
}

describe("le pluriel de zéro", () => {
  const fichiers = fichiersLangue();
  const sources = fichiers.map((f) => [f, readFileSync(join(RACINE_I18N, f), "utf8")] as const);
  const porteurs = sources.filter(([, s]) => porteDuTexte(s));

  it("regarde vraiment des dictionnaires, et y voit des blocs de langue", () => {
    // Sans témoin, un dossier renommé ou un motif de bloc devenu aveugle
    // rendrait le contrôle vert en n'examinant aucun gabarit.
    expect(fichiers.length).toBeGreaterThan(20);
    const avecBlocs = sources.filter(([, s]) => blocs(s).length >= 6);
    expect(avecBlocs.length).toBeGreaterThan(20);
  });

  it("les deux formes sont dans le champ, et hors du sous-dossier aussi", () => {
    /**
     * Un témoin PAR FORME, sinon deux aveuglements passent au vert.
     *
     * Le compte de fichiers ne les distingue pas : les cinquante-neuf du
     * sous-dossier suffisent à le satisfaire, donc il reste vert le jour où
     * le lecteur de blocs cesse de voir l'indentation à quatre espaces de
     * `metadonnees.ts`, ou la forme sans bloc d'`apiErrors.ts`.
     */
    const horsDossier = porteurs.filter(([f]) => !f.includes("/"));
    expect(horsDossier.length).toBeGreaterThanOrEqual(6);
    // `metadonnees.ts` porte huit blocs `fr:` à quatre espaces.
    expect(sources.filter(([, s]) => blocs(s).filter((b) => b.langue === "fr").length >= 4).length)
      .toBeGreaterThanOrEqual(1);
    // `apiErrors.ts` n'en porte aucun, et ses clés sont le français.
    expect(sources.filter(([, s]) => blocs(s).length === 0 && clesTraduites(s) >= 20).length)
      .toBeGreaterThanOrEqual(1);
  });

  it("emploie n !== 1 partout sauf en français", () => {
    const fautifs: string[] = [];
    let examines = 0;
    for (const [f, source] of porteurs) {
      const bornes = blocs(source);
      for (const m of source.matchAll(/>\s*1\s*\?/g)) {
        examines += 1;
        let langue = "?";
        for (const b of bornes) if (b.debut < (m.index ?? 0)) langue = b.langue;
        if (langue !== "fr") {
          const ligne = source.slice(0, m.index).split("\n").length;
          fautifs.push(`${f}:${ligne} · bloc ${langue}`);
        }
      }
    }

    // Le second témoin : si plus aucun gabarit ne s'écrivait avec un seuil,
    // le contrôle passerait au vert sans rien garder.
    expect(examines).toBeGreaterThan(5);
    expect(fautifs).toEqual([]);
  });
});
