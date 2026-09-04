import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
 */

const RACINE = join(process.cwd(), "src/lib/i18n/dictionaries");

/** Les blocs de langue d'un fichier de dictionnaire, dans l'ordre du texte. */
function blocs(source: string): { langue: string; debut: number }[] {
  return [...source.matchAll(/\n {2}(fr|en|es|de|zh|ja):\s*\{/g)].map((m) => ({
    langue: m[1],
    debut: m.index ?? 0,
  }));
}

describe("le pluriel de zéro", () => {
  const fichiers = readdirSync(RACINE).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("regarde vraiment des dictionnaires, et y voit des blocs de langue", () => {
    // Sans témoin, un dossier renommé ou un motif de bloc devenu aveugle
    // rendrait le contrôle vert en n'examinant aucun gabarit.
    expect(fichiers.length).toBeGreaterThan(20);
    const avecBlocs = fichiers.filter((f) => blocs(readFileSync(join(RACINE, f), "utf8")).length >= 6);
    expect(avecBlocs.length).toBeGreaterThan(20);
  });

  it("emploie n !== 1 partout sauf en français", () => {
    const fautifs: string[] = [];
    let examines = 0;
    for (const f of fichiers) {
      const source = readFileSync(join(RACINE, f), "utf8");
      const bornes = blocs(source);
      if (bornes.length === 0) continue;
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
