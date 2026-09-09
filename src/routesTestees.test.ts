import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Toute route d'API est importée par un test, ou déclarée avec sa raison.
 *
 * Ce fichier a corrigé une phrase de `CLAUDE.md` qui affirmait « toutes les
 * routes ont un test, sauf `auth/[...nextauth]` ». Elle était fausse de trois
 * routes — les deux images et l'icône de l'application installée — et rien ne
 * pouvait le dire : une route sans test ne casse pas, elle ne prouve rien.
 *
 * **Et le premier recensement s'était trompé dans l'autre sens.** Chercher un
 * test COLOCALISÉ en rendait douze, dont huit parfaitement couvertes par un
 * test qui vit ailleurs. Un recensement par emplacement de fichier hérite de
 * la convention de celui qui l'écrit ; ce qui tranche est la RÉSOLUTION des
 * imports, comme dans `codeMort.test.ts`.
 *
 * Ce garde ne juge pas la QUALITÉ d'un test — un fichier qui importerait une
 * route sans rien en éprouver le satisferait. Ce qu'il attrape est la route
 * qu'on ajoutera demain et que personne n'ouvrira jamais.
 */
const SRC = __dirname;
const API = join(SRC, "app", "api");

/**
 * Les routes qu'aucun test n'a de raison d'importer, chacune avec la sienne.
 *
 * Une exemption sans raison écrite finit par toutes les couvrir.
 */
const SANS_TEST: Record<string, string> = {
  "auth/[...nextauth]": "les gestionnaires appartiennent à Auth.js ; les tester reviendrait à tester la bibliothèque",
};

function fichiers(dossier: string, trouves: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const complet = join(dossier, entree.name);
    if (entree.isDirectory()) fichiers(complet, trouves);
    else trouves.push(complet);
  }
  return trouves;
}

/** Le fichier réellement désigné par un spécificateur d'import, ou `null`. */
function resoudre(depuis: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith(".")) base = resolve(dirname(depuis), spec);
  else if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else return null;
  for (const suffixe of ["", ".ts", ".tsx", "/route.ts", "/route.tsx", "/index.ts"]) {
    const candidat = base + suffixe;
    if (existsSync(candidat) && statSync(candidat).isFile()) return candidat;
  }
  return null;
}

/** Tout ce que les tests importent, résolu jusqu'au fichier. */
function importeParLesTests(tests: string[]): Set<string> {
  const vus = new Set<string>();
  for (const test of tests) {
    const source = readFileSync(test, "utf8");
    for (const m of source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const cible = resoudre(test, m[1]);
      if (cible) vus.add(cible);
    }
  }
  return vus;
}

const tous = fichiers(SRC);
const routes = tous.filter((f) => /[/\\]route\.tsx?$/.test(f) && f.startsWith(API));
const tests = tous.filter((f) => /\.test\.tsx?$/.test(f));
const couvertes = importeParLesTests(tests);

/** `admin/users/[id]`, tel qu'on le nomme dans la liste des exemptions. */
const nom = (route: string) =>
  route.slice(API.length + 1).replace(/[/\\]route\.tsx?$/, "").replace(/\\/g, "/");

describe("les routes d'API sont éprouvées", () => {
  it("le recensement lit quelque chose", () => {
    // Sans ce contrôle, un dossier renommé rendrait le test vert sur zéro
    // route et zéro test — la forme d'erreur que ce fichier existe pour dire.
    expect(routes.length).toBeGreaterThanOrEqual(50);
    expect(tests.length).toBeGreaterThanOrEqual(100);
  });

  it("la résolution des imports distingue vraiment", () => {
    // L'état sain du dépôt est « presque tout est couvert » : il ne peut donc
    // pas montrer qu'une résolution cassée — qui rendrait tout couvert — a
    // cessé de trier. Deux cas fabriqués le montrent.
    const test = join(API, "games", "route.test.ts");
    expect(resoudre(test, "./route")).toBe(join(API, "games", "route.ts"));
    expect(resoudre(test, "./route-qui-nexiste-pas")).toBeNull();
    expect(resoudre(test, "next/server")).toBeNull();
  });

  it("chaque route est importée par un test, ou déclarée", () => {
    const orphelines = routes
      .filter((r) => !couvertes.has(r))
      .map(nom)
      .filter((n) => !(n in SANS_TEST));
    expect(orphelines).toEqual([]);
  });

  it("une exemption qui ne désigne plus rien tombe", () => {
    // Une route supprimée, ou qui a fini par recevoir son test, laisse une
    // ligne morte dans le garde qui existe pour attraper le code mort.
    const vivantes = new Set(routes.map(nom));
    for (const [route, raison] of Object.entries(SANS_TEST)) {
      expect(vivantes.has(route)).toBe(true);
      expect(couvertes.has(join(API, route, "route.ts"))).toBe(false);
      expect(raison.length).toBeGreaterThan(20);
    }
  });
});
