import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Du texte écrit par quelqu'un d'autre doit pouvoir être COUPÉ.
 *
 * `white-space: pre-wrap` conserve les retours à la ligne, ce qu'on veut pour
 * un signalement de bug tapé à la main. Il ne dit rien de ce qu'il faut faire
 * d'un mot qui n'a aucun espace : une trace d'erreur, une adresse collée, un
 * clavier martelé. Le navigateur pousse alors la ligne aussi loin qu'il le
 * faut, et c'est la PAGE qui déborde, pas le paragraphe.
 *
 * Mesuré sur le panneau d'administration, avec un signalement d'essai de
 * quinze mille caractères sans espace : la page débordait de 15 348 px
 * latéralement. Sur un téléphone, l'écran part de côté et ne revient pas.
 *
 * La règle vaut pour la classe et pas pour la ligne : tout endroit qui pose
 * `pre-wrap` porte du texte qu'on n'a pas écrit — sinon on n'aurait pas besoin
 * de conserver ses retours à la ligne — donc tout endroit qui pose `pre-wrap`
 * doit dire comment couper.
 */
const SRC = join(__dirname);

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      if (entree === "generated" || entree === "node_modules") continue;
      trouves.push(...fichiers(complet));
    } else if (/\.tsx?$/.test(entree) && !/\.test\.tsx?$/.test(entree)) {
      trouves.push(complet);
    }
  }
  return trouves;
}

/**
 * Les objets de style qui posent `pre-wrap`, avec le fichier et la ligne.
 *
 * On lit l'objet ENTIER — de son accolade ouvrante à sa fermante — et pas la
 * ligne : une déclaration de style écrite sur plusieurs lignes échapperait à
 * une recherche ligne à ligne, et c'est précisément la forme qu'on écrit
 * quand le style devient long. Le défaut trouvé, lui, tenait sur une ligne :
 * c'est la chance, pas la règle.
 */
function stylesPreWrap(source: string): string[] {
  const objets: string[] = [];
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "{") continue;
    let profondeur = 0;
    let fin = -1;
    for (let j = i; j < source.length && j < i + 4000; j++) {
      if (source[j] === "{") profondeur++;
      else if (source[j] === "}") {
        profondeur--;
        if (profondeur === 0) { fin = j; break; }
      }
    }
    if (fin === -1) continue;
    const objet = source.slice(i, fin + 1);
    if (/whiteSpace\s*:\s*["'`]pre-wrap|white-space\s*:\s*pre-wrap/.test(objet)) {
      objets.push(objet);
    }
  }
  return objets;
}

describe("le texte écrit par quelqu'un d'autre", () => {
  const trouves = fichiers(SRC).flatMap((f) =>
    stylesPreWrap(readFileSync(f, "utf8")).map((objet) => ({ f, objet })),
  );

  /**
   * Sans ce contrôle, un motif devenu aveugle — une propriété renommée, un
   * dossier déplacé — rendrait le test vert en n'examinant aucun style. C'est
   * exactement la famille d'erreur que `gardesNonVides` surveille.
   */
  it("examine vraiment des styles", () => {
    expect(trouves.length).toBeGreaterThan(0);
  });

  it("peut être coupé quand il n'a aucun espace", () => {
    const sansCoupure = trouves
      .filter(({ objet }) => !/overflowWrap|overflow-wrap|wordBreak|word-break/.test(objet))
      .map(({ f }) => f.slice(SRC.length + 1));
    expect({ sansCoupure }).toEqual({ sansCoupure: [] });
  });
});
