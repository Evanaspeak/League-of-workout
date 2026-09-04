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
  // Outillage de test : il ne sert qu'aux tests, par construction. Le compter
  // comme un module du produit ferait dire au garde qu'il faut lui écrire un
  // lecteur, alors que ses lecteurs sont exactement ceux qu'on attend.
  "test/api.ts",
];

/**
 * Le jour où un module commis sans lecteur cesse d'être toléré.
 *
 * Un module peut naître avec ses tests une nuit et recevoir son écran la
 * suivante — c'est arrivé à `conversionDette.ts`, et c'est légitime. Ce qui ne
 * l'est pas, c'est de laisser ça durer : passé une semaine, on ne sait plus si
 * l'écran arrive ou si le module a été abandonné, et personne ne rouvre le
 * fichier pour se poser la question.
 *
 * Sept jours. Le chiffre est ici, une seule fois : une tolérance dont chaque
 * entrée porterait sa propre échéance se prolongerait indéfiniment, une ligne
 * après l'autre, sans que rien ne le montre.
 */
const DELAI_JOURS = 7;

/**
 * Un module écrit et éprouvé, dont l'écran n'est pas encore là.
 *
 * `ajouteLe` est le jour où le module a été commis sans lecteur — pas le jour
 * où l'on ajoute la ligne ici, sans quoi il suffirait de repousser la date
 * pour repousser l'échéance.
 */
const ECRITS_SANS_LECTEUR: { chemin: string; ajouteLe: string }[] = [];

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
  /**
   * Les fichiers de la RACINE comptent comme lecteurs, et l'oublier fabrique
   * un faux positif.
   *
   * `middleware.ts` vit à la racine du dépôt, et c'est le seul lecteur de
   * `lib/pagesConnues.ts`. Sans lui, ce module parfaitement vivant serait
   * déclaré « lu par ses seuls tests » — donc le garde enverrait supprimer ou
   * brancher quelque chose qui est déjà branché.
   */
  const racine = readdirSync(RACINE, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => join(RACINE, e.name));

  const tous = [
    ...fichiersSource(SRC),
    ...fichiersSource(join(RACINE, "e2e")),
    ...racine,
  ];

  /**
   * Ce qui est du côté des TESTS ne compte pas comme lecteur.
   *
   * C'est l'angle mort que ce garde a eu jusqu'ici : il écarte les fichiers de
   * test de la liste des CANDIDATS — un test n'a pas à être importé — mais pas
   * de la liste des LECTEURS. Un module importé par son seul fichier de test
   * passait donc pour lu, c'est-à-dire précisément le cas d'un module qu'on a
   * écrit puis abandonné.
   */
  const estCoteTest = (abs: string) => {
    const rel = relative(RACINE, abs);
    return (
      /\.(test|spec)\.tsx?$/.test(rel) ||
      rel.startsWith("e2e/") ||
      rel.startsWith("src/test/")
    );
  };

  // Toutes les cibles d'import du dépôt, quelle qu'en soit la forme :
  // `from "…"`, `import("…")` pour le chargement différé, `require("…")`.
  // Chacune est ramenée à un chemin relatif à `src/`, sans extension, pour que
  // `./LandingClient`, `../components/Nav` et `@/lib/prisma` se comparent tous
  // à la même chose : le fichier qu'ils désignent réellement.
  function ciblesDe(liste: string[]): Set<string> {
    const s = new Set<string>();
    for (const fichier of liste) {
      const contenu = readFileSync(fichier, "utf8");
      for (const m of contenu.matchAll(/(?:from|import|require)\s*\(?\s*"([^"]+)"/g)) {
        const brut = m[1];
        if (brut.startsWith("@/")) s.add(brut.slice(2));
        else if (brut.startsWith(".")) s.add(relative(SRC, join(fichier, "..", brut)));
      }
    }
    return s;
  }

  const cibles = ciblesDe(tous);
  const ciblesHorsTests = ciblesDe(tous.filter((f) => !estCoteTest(f)));

  /** Le chemin sous lequel un import désigne ce fichier. */
  const cheminDe = (rel: string) =>
    rel.replace(/\.tsx?$/, "").replace(/\/index$/, "");

  /** Les modules de `src/` qu'un import doit atteindre, conventions écartées. */
  const candidats = () =>
    fichiersSource(SRC)
      .map((f) => relative(SRC, f))
      .filter((rel) => !/\.test\.tsx?$/.test(rel))
      .filter((rel) => !CONVENTIONS_NEXT.some((r) => r.test("/" + rel) || r.test(rel)))
      // Les déclarations de types augmentent des modules extérieurs : elles
      // s'appliquent par leur seule présence, sans qu'on les importe.
      .filter((rel) => !rel.endsWith(".d.ts"))
      .filter((rel) => !ENGENDRES.some((r) => r.test(rel)))
      .filter((rel) => !TOLERES.includes(rel));

  /**
   * Sans témoin, un dossier renommé ou un motif d'import qui ne trouve plus
   * rien rendrait ce fichier vert en n'examinant aucun module. C'est la règle
   * que les vingt-deux autres gardes structurels du projet appliquent, et que
   * celui-ci n'appliquait pas — alors qu'il est de ceux qui SUPPRIMENT du code
   * sur la foi de ce qu'ils lisent.
   */
  it("regarde vraiment des fichiers, et voit leurs imports", () => {
    expect(tous.length).toBeGreaterThan(200);
    expect(cibles.size).toBeGreaterThan(100);

    // Sans fichier à la racine, `middleware.ts` sort du compte des lecteurs et
    // `lib/pagesConnues.ts` devient un faux orphelin.
    expect(racine.map((f) => relative(RACINE, f))).toContain("middleware.ts");

    // Le témoin du DÉCOUPAGE, et c'est celui qui décide du contrôle suivant :
    // si `estCoteTest` cessait de reconnaître quoi que ce soit, les deux
    // ensembles seraient identiques, plus aucun module ne pourrait être « lu
    // par ses seuls tests », et le garde passerait au vert en ne cherchant
    // rien.
    expect(ciblesHorsTests.size).toBeGreaterThan(100);
    expect(cibles.size).toBeGreaterThan(ciblesHorsTests.size);
  });

  it("aucun module de src/ n'est laissé sans lecteur", () => {
    // Un import peut viser `@/x/y`, `./y` ou `../x/y` : on compare sur le
    // chemin sans extension, en acceptant qu'il soit atteint par sa fin.
    const orphelins = candidats().filter((rel) => !cibles.has(cheminDe(rel)));

    expect(orphelins).toEqual([]);
  });

  /**
   * Un module dont le seul lecteur est son propre test passe pour vivant.
   *
   * Le cas est légitime une nuit et suspect une semaine plus tard. La tolérance
   * porte donc une DATE : elle laisse passer le module qu'on vient d'écrire, et
   * elle mord toute seule si l'écran n'arrive jamais — sans qu'il faille penser
   * à rouvrir le fichier, ce que personne ne fait.
   */
  it("un module éprouvé sans être employé est toléré, mais pas indéfiniment", () => {
    const seulsParTests = candidats().filter(
      (rel) => cibles.has(cheminDe(rel)) && !ciblesHorsTests.has(cheminDe(rel)),
    );

    const echeance = (ajouteLe: string) =>
      new Date(new Date(ajouteLe + "T00:00:00Z").getTime() + DELAI_JOURS * 86_400_000);

    const sansTolerance = seulsParTests.filter(
      (rel) => !ECRITS_SANS_LECTEUR.some((t) => t.chemin === rel),
    );
    expect(sansTolerance).toEqual([]);

    const perimes = ECRITS_SANS_LECTEUR.filter(
      (t) => echeance(t.ajouteLe) < new Date(),
    ).map((t) => `${t.chemin} (toléré depuis le ${t.ajouteLe})`);
    expect(perimes).toEqual([]);

    // Une tolérance qui ne désigne plus rien de vivant est du code mort à son
    // tour : le module a reçu son lecteur, ou il a été supprimé.
    const caduques = ECRITS_SANS_LECTEUR.filter(
      (t) => !seulsParTests.includes(t.chemin),
    ).map((t) => t.chemin);
    expect(caduques).toEqual([]);
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
      /**
       * Les commentaires d'abord.
       *
       * Le motif cherche un point suivi d'un nom, ce qu'un nom de fichier cité
       * dans un commentaire produit aussi : « e2e/historique.spec.ts » y a été
       * lu comme la classe `.spec`, réputée morte, et un billet écrit dans une
       * feuille de style a fait échouer la suite. Un commentaire ne déclare
       * aucun sélecteur.
       */
      const source = readFileSync(feuille, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
      for (const m of source.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
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
