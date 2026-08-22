import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Un module que personne n'importe.
 *
 * Trois trouvailles en une nuit : deux dictionnaires de langue restés six
 * semaines après la suppression de leurs écrans, et un bouton de connexion
 * desktop remplacé par une version intégrée à `LoginButtons`. Aucun des trois
 * ne se voyait : TypeScript ne se plaint pas d'un fichier que personne ne lit,
 * ESLint non plus, et le compilateur l'écarte du paquet livré — le coût est
 * humain, pas technique. On le paie en le traduisant, en le corrigeant, en
 * l'auditant, pour rien.
 *
 * Ce test lit les imports de tout le dépôt et exige que chaque fichier de
 * `src/` y figure au moins une fois. Les fichiers que Next.js appelle par leur
 * nom, jamais par un import, sont listés à part.
 */

const RACINE = join(__dirname, "..");
const SRC = join(RACINE, "src");

/**
 * Fichiers que le cadriciel charge par convention de nom.
 *
 * Next.js lit `page`, `layout`, `route` et compagnie par leur chemin : aucun
 * fichier du dépôt ne les importe, et c'est normal.
 */
const CONVENTIONS_NEXT = [
  /\/(page|layout|route|template|default|loading|error|global-error|not-found)\.tsx?$/,
  /\/(sitemap|robots|manifest)\.ts$/,
  /\/(icon|apple-icon|opengraph-image|twitter-image)\.tsx?$/,
  /^middleware\.ts$/,
  /^auth\.ts$/,
  /^instrumentation(-client)?\.ts$/,
];

/** Dossiers engendrés : leur contenu ne se juge pas comme du code écrit. */
const ENGENDRES = [/^generated\//];

/** Fichiers dont l'absence d'import est voulue et assumée. */
const TOLERES: string[] = [
  "test/setup.ts",
];

function fichiersSource(dossier: string, out: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith(".") || entree.name === "node_modules") continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) fichiersSource(chemin, out);
    else if (/\.(ts|tsx)$/.test(entree.name)) out.push(chemin);
  }
  return out;
}

describe("code mort", () => {
  const tous = [
    ...fichiersSource(SRC),
    ...fichiersSource(join(RACINE, "e2e")),
  ];

  // Toutes les cibles d'import du dépôt, quelle qu'en soit la forme :
  // `from "…"`, `import("…")` pour le chargement différé, `require("…")`.
  // Chacune est ramenée à un chemin relatif à `src/`, sans extension, pour que
  // `./LandingClient`, `../components/Nav` et `@/lib/prisma` se comparent tous
  // à la même chose : le fichier qu'ils désignent réellement.
  const cibles = new Set<string>();
  for (const fichier of tous) {
    const contenu = readFileSync(fichier, "utf8");
    for (const m of contenu.matchAll(/(?:from|import|require)\s*\(?\s*"([^"]+)"/g)) {
      const brut = m[1];
      if (brut.startsWith("@/")) cibles.add(brut.slice(2));
      else if (brut.startsWith(".")) cibles.add(relative(SRC, join(fichier, "..", brut)));
    }
  }

  it("aucun module de src/ n'est laissé sans lecteur", () => {
    const orphelins = fichiersSource(SRC)
      .map((f) => relative(SRC, f))
      .filter((rel) => !/\.test\.tsx?$/.test(rel))
      .filter((rel) => !CONVENTIONS_NEXT.some((r) => r.test("/" + rel) || r.test(rel)))
      // Les déclarations de types augmentent des modules extérieurs : elles
      // s'appliquent par leur seule présence, sans qu'on les importe.
      .filter((rel) => !rel.endsWith(".d.ts"))
      .filter((rel) => !ENGENDRES.some((r) => r.test(rel)))
      .filter((rel) => !TOLERES.includes(rel))
      .filter((rel) => {
        // Un import peut viser `@/x/y`, `./y` ou `../x/y` : on compare sur le
        // chemin sans extension, en acceptant qu'il soit atteint par sa fin.
        const chemin = rel.replace(/\.tsx?$/, "").replace(/\/index$/, "");
        return !cibles.has(chemin);
      });

    expect(orphelins).toEqual([]);
  });
});

/**
 * Une classe CSS que personne ne pose.
 *
 * Une section entière de la page d'accueil a été réécrite en juin ; sa feuille
 * de style est restée, 85 lignes que le navigateur télécharge à chaque visite
 * pour n'en rien faire. Rien ne le disait : le CSS ne se compile pas, et une
 * règle sans élément à qui s'appliquer ne produit aucune erreur.
 *
 * Le contrôle est volontairement permissif — il suffit que le nom de la classe
 * paraisse quelque part dans le code pour qu'elle soit tenue pour employée.
 * Une classe composée à la volée (`` `tarif-${x}` ``) ne doit jamais faire
 * échouer une poussée légitime ; mieux vaut laisser passer une classe morte
 * que bloquer une classe vivante.
 */
describe("CSS mort", () => {
  function feuilles(dossier: string, out: string[] = []): string[] {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      if (entree.name.startsWith(".") || entree.name === "node_modules") continue;
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) feuilles(chemin, out);
      else if (entree.name.endsWith(".css")) out.push(chemin);
    }
    return out;
  }

  it("chaque classe déclarée est posée quelque part", () => {
    const code = fichiersSource(SRC)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

    const inutiles: string[] = [];
    const vues = new Set<string>();
    for (const feuille of feuilles(SRC)) {
      for (const m of readFileSync(feuille, "utf8").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
        const classe = m[1];
        if (vues.has(classe)) continue;
        vues.add(classe);
        if (!new RegExp(`\\b${classe}\\b`).test(code)) {
          inutiles.push(`${classe} (${relative(SRC, feuille)})`);
        }
      }
    }

    expect(inutiles).toEqual([]);
  });
});
