/**
 * Une quantité et le nom de son exercice s'écrivent dans CET ordre : le
 * nombre, puis le nom.
 *
 * C'est l'ordre de tout le produit — la pastille en jeu, le décompte de
 * dette, les cellules de l'historique, les deux notifications. Une seule
 * ligne l'inversait : le résumé de l'historique écrivait
 * « 60 parties · Pompes 480 », c'est-à-dire nombre puis nom d'un côté du
 * point médian et nom puis nombre de l'autre, sur la même ligne.
 *
 * Ça ne se voit pas en français, où « parties » et « Pompes » se ressemblent
 * assez pour qu'on ne compare pas les deux moitiés. Ça se voit en japonais,
 * où « 腕立て 480 » porte une espace latine au milieu des idéogrammes, et où
 * la cellule juste en dessous écrit « 8腕立て ».
 *
 * Le garde porte sur les GABARITS, parce que c'est la forme qui compose une
 * phrase — le JSX, lui, pose ses éléments côte à côte et l'ordre s'y lit à
 * l'œil sur une ligne.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname);

/** Une lecture de nom d'exercice : `nomsExo[x]`, `noms[x]`, `nomsExercices(t)[x]`. */
const NOM = /\$\{\s*(?:minuscule\()?\s*noms(?:Exo|Exercices\([^)]*\))?\s*\[/;

/** Une mise en forme de quantité. */
const QUANTITE = /\$\{\s*formater(?:Quantite|Compact|Duree)\s*\(/;

/**
 * Rend les gabarits fautifs d'une source : ceux où le NOM précède la
 * QUANTITÉ.
 *
 * Il vit hors de la boucle pour être éprouvé sur des cas fabriqués — l'état
 * sain du dépôt est ZÉRO trouvaille, donc les fichiers réels ne peuvent pas
 * distinguer un motif juste d'un motif aveugle.
 */
export function nomAvantQuantite(source: string): string[] {
  const fautifs: string[] = [];
  for (const gabarit of gabarits(source)) {
    const nom = gabarit.search(NOM);
    const quantite = gabarit.search(QUANTITE);
    if (nom !== -1 && quantite !== -1 && nom < quantite) fautifs.push(gabarit.trim());
  }
  return fautifs;
}

/**
 * Les gabarits d'une source, accents graves compris.
 *
 * Découpage volontairement simple : on ne cherche pas à comprendre le
 * JavaScript, seulement à isoler ce qui est entre deux accents graves sur une
 * même expression. Un accent grave échappé y met fin — c'est acceptable, il
 * n'y en a aucun dans les gabarits qui nous occupent.
 */
export function gabarits(source: string): string[] {
  return source.match(/`[^`]*`/g) ?? [];
}

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name === "generated" || e.name === "node_modules") continue;
      sortie.push(...fichiers(chemin));
    } else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

describe("la quantité vient avant le nom de son exercice", () => {
  const sources = fichiers(SRC).map((f) => [f, readFileSync(f, "utf8")] as const);

  it("aucun gabarit ne place le nom avant la quantité", () => {
    const fautifs = sources.flatMap(([f, s]) =>
      nomAvantQuantite(s).map((g) => `${f.replace(SRC, "src")} : ${g}`),
    );
    expect(fautifs).toEqual([]);
  });

  it("le recensement a réellement lu quelque chose", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert en
    // n'ouvrant aucun fichier — le défaut que ce projet attrape le plus.
    const tous = sources.flatMap(([, s]) => gabarits(s));
    expect(sources.length).toBeGreaterThan(100);
    expect(tous.length).toBeGreaterThan(200);
    // Et au moins un gabarit doit encore lire un nom d'exercice : sinon le
    // motif pourrait ne plus rien reconnaître sans que rien ne le dise.
    expect(tous.filter((g) => NOM.test(g)).length).toBeGreaterThan(0);
  });

  it("le tri se comporte comme annoncé sur des cas fabriqués", () => {
    // Les fichiers réels ne portent, par construction, que des cas acceptés :
    // ils ne distinguent pas un motif juste d'un motif qui rend toujours
    // « rien à signaler ».
    const fautif = [
      "`${nomsExo[id]} ${formaterQuantite(q, id, l)}`",
      "`${minuscule(nomsExo[id])} ${formaterCompact(p, id, r, l)}`",
      "`${nomsExercices(t)[id]} : ${formaterDuree(s, l)}`",
    ];
    const juste = [
      "`${formaterQuantite(q, id, l)} ${minuscule(nomsExo[id])}`",
      "`${formaterCompact(p, id, r, l)} ${nomsExo[id]}`",
      "`${nomsExo[id]}`",
      "`${formaterDuree(s, l)}`",
      "`rien à voir ${autre}`",
    ];
    for (const cas of fautif) expect(nomAvantQuantite(cas)).toHaveLength(1);
    for (const cas of juste) expect(nomAvantQuantite(cas)).toHaveLength(0);
  });
});
