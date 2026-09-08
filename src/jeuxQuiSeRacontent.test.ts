import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JEUX, JEUX_QUI_SE_RACONTENT } from "@/lib/jeux";

/**
 * Les jeux qui racontent leur partie, écrits une seule fois de chaque côté.
 *
 * La liste vivait TROIS fois — la pastille du site, `main.js` et `overlay.js` —
 * sous DEUX noms pour le même ensemble : `JEUX_QUI_SE_RACONTENT` d'un côté,
 * `JEUX_AVEC_RELEVE` de l'autre. Les trois coïncidaient, ce qui est le cas
 * normal : une duplication ne se remarque jamais tant qu'elle n'a pas divergé,
 * et c'est ce qui la rend chère.
 *
 * Ce que coûterait la divergence : le site publierait une projection que la
 * pastille ne montre pas, ou la pastille réserverait des lignes que personne ne
 * remplit. Aucune erreur, aucun test rouge — et visible seulement pendant une
 * partie, sur la machine de quelqu'un d'autre.
 *
 * Le site la DÉDUIT du catalogue depuis. La coquille Electron, elle, se
 * construit sans le paquet du site : elle garde sa copie, et **ce qui ne peut
 * pas s'importer se COMPARE**. C'est la règle déjà posée pour la table des
 * processus surveillés, et pour les six langues.
 */

const COQUILLE = join(process.cwd(), "desktop", "src", "jeuxReleve.js");

/** Les noms que la coquille écrit, lus dans sa source. */
function listeDeLaCoquille(): string[] {
  const source = readFileSync(COQUILLE, "utf8");
  const m = /const JEUX_QUI_SE_RACONTENT = new Set\(\[([^\]]*)\]\);/.exec(source);
  if (!m) throw new Error("La liste de desktop/src/jeuxReleve.js est introuvable.");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
}

describe("les jeux qui racontent leur partie", () => {
  it("le catalogue en désigne bien une poignée", () => {
    // Le témoin. Sans lui, un drapeau retiré de tous les jeux rendrait la
    // comparaison verte sur deux ensembles vides.
    expect(JEUX_QUI_SE_RACONTENT.size).toBeGreaterThanOrEqual(2);
    expect(JEUX.length).toBeGreaterThan(10);
    expect([...JEUX_QUI_SE_RACONTENT]).toContain("League of Legends");
  });

  it("la coquille dit exactement la même chose que le catalogue", () => {
    expect(listeDeLaCoquille()).toEqual([...JEUX_QUI_SE_RACONTENT].sort());
  });

  it("chaque jeu de la liste existe au catalogue", () => {
    // L'autre sens : un nom mal orthographié d'un côté ne désignerait rien, et
    // le jeu perdrait sa projection sans que rien ne le dise.
    const noms = new Set(JEUX.map((j) => j.nom));
    expect([...JEUX_QUI_SE_RACONTENT].filter((n) => !noms.has(n))).toEqual([]);
  });

  it("aucun écran ne réécrit la liste en dur", () => {
    /**
     * DEUX noms voisins entre guillemets : la forme qu'une liste réécrite prend
     * forcément, et ce qui la distingue d'un nom de jeu mentionné seul — le jeu
     * par défaut de l'aperçu, par exemple, qui est légitime.
     */
    const membres = [...JEUX_QUI_SE_RACONTENT];
    const fautifs: string[] = [];
    for (const chemin of ["src/components/DetteDirecte.tsx", "src/lib/jeux.ts"]) {
      const texte = readFileSync(join(process.cwd(), chemin), "utf8");
      for (const a of membres) {
        for (const b of membres) {
          if (a !== b && texte.includes(`"${a}", "${b}"`)) fautifs.push(`${chemin} : ${a}, ${b}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("la pastille du site lit bien la source", () => {
    // Sans ce contrôle, retirer la liste sans la remplacer passerait : le
    // précédent est un refus, pas une exigence.
    const texte = readFileSync(join(process.cwd(), "src/components/DetteDirecte.tsx"), "utf8");
    expect(texte).toMatch(/\bJEUX_QUI_SE_RACONTENT\b/);
  });
});
