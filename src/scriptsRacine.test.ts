/**
 * Pas de script d'un soir oublié à la racine.
 *
 * `diag.mjs` y vivait depuis la nuit où l'image du bilan de saison partait
 * quatre étapes trop tard. Il avait servi, il avait été commis avec la
 * correction, et il n'a plus rien fait pendant dix jours — chemins codés en
 * dur, cookie nommé à la main, aucune référence.
 *
 * `codeMort.test.ts` ne pouvait pas le voir : il ne regarde que `src/`. Or
 * c'est justement DEHORS que ce genre de fichier atterrit — on le pose là pour
 * l'exécuter vite, et il y reste. Le coût est humain, comme pour le code mort
 * ordinaire : on le lit en cherchant autre chose, on se demande s'il sert, on
 * hésite à le supprimer.
 *
 * Les fichiers de configuration, eux, doivent rester : ils sont chargés par
 * leur nom, par un outil, sans que personne ne les importe.
 */
import { execSync } from "child_process";
import { join } from "path";

const RACINE = join(__dirname, "..");

/**
 * Ce qu'un OUTIL charge par son nom, sans que personne ne l'importe.
 *
 * `middleware.ts` n'est pas une configuration mais il obéit à la même règle :
 * Next.js le trouve par son nom, et aucun fichier ne le référence. Une entrée
 * de plus doit être une décision, pas un oubli — c'est tout l'intérêt de la
 * liste.
 */
const CHARGES_PAR_NOM = new Set([
  "eslint.config.mjs",
  "jest.config.js",
  "middleware.ts",
  "next.config.ts",
  "playwright.config.ts",
  "postcss.config.mjs",
  "prisma.config.ts",
]);

describe("la racine du dépôt", () => {
  const suivis = execSync("git ls-files --", { cwd: RACINE, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !f.includes("/"));

  // Sans ce contrôle, un `git ls-files` qui ne rend rien — dépôt déplacé,
  // commande absente — rendrait le test vert en ne regardant aucun fichier.
  it("se lit vraiment", () => {
    expect(suivis.length).toBeGreaterThan(5);
    expect(suivis).toContain("package.json");
  });

  it("ne porte aucun script hors configuration", () => {
    const scripts = suivis.filter(
      (f) => /\.(mjs|cjs|js|ts)$/.test(f) && !CHARGES_PAR_NOM.has(f),
    );
    expect(scripts).toEqual([]);
  });
});
