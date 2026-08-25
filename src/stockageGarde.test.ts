import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export {};

/**
 * Personne ne touche au stockage du navigateur directement.
 *
 * `localStorage` n'est pas une propriété : c'est un accesseur, et il **lève**
 * quand le navigateur est réglé pour bloquer les données de site. Pas
 * l'écriture, l'accès. Soixante et un appels le faisaient à nu, dont ceux de
 * `LoginButtons`, `SessionGuard` et `OnboardingModal` — une exception y casse
 * l'écran de connexion en entier, pour quelqu'un qui n'a aucun recours et
 * aucune raison de faire le lien avec un réglage de son navigateur.
 *
 * Le module `src/lib/stockage.ts` traite le cas une fois. Ce garde existe
 * parce qu'une correction mécanique de soixante et un appels ne tient pas
 * d'elle-même : le soixante-deuxième s'écrit sans y penser, et il ne casse
 * rien avant de tomber chez la mauvaise personne.
 */

const RACINE = join(process.cwd(), "src");

/** Le seul endroit qui a le droit d'ouvrir le coffre. */
const MODULE = "lib/stockage.ts";

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "generated") continue;
      out.push(...fichiers(chemin));
      continue;
    }
    if (/\.tsx?$/.test(entree)) out.push(chemin);
  }
  return out;
}

describe("accès au stockage du navigateur", () => {
  const tous = fichiers(RACINE);

  it("lit bien l'arborescence", () => {
    // Sans ce contrôle, un dossier renommé rendrait le test vert sur zéro
    // fichier lu : la forme d'erreur qu'on cherche justement à éviter.
    expect(tous.length).toBeGreaterThan(100);
  });

  it("ne passe que par le module prévu", () => {
    const coupables = tous
      .filter((f) => !f.endsWith(MODULE) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /\b(local|session)Storage\s*\./.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(RACINE.length + 1).replace(/\\/g, "/"))
      .sort();
    expect(coupables).toEqual([]);
  });

  it("et le module, lui, y touche vraiment", () => {
    // Sans quoi le motif pourrait avoir disparu partout, y compris là où il
    // doit être, et le test resterait vert en ne gardant plus rien.
    const source = readFileSync(join(RACINE, MODULE), "utf8");
    expect(source).toMatch(/window\.localStorage/);
    expect(source).toMatch(/window\.sessionStorage/);
  });
});
