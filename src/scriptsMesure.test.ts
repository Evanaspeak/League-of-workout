import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Les outils de mesure lisent leurs arguments de la MÊME façon.
 *
 * Quatre scripts, un drapeau `--langue=xx`, et trois d'entre eux qui lisaient
 * en plus leur adresse par le RANG (`process.argv[2]`). Un drapeau posé avant
 * l'adresse devenait donc l'adresse : `accessibilite.mjs` a rendu « quinze
 * pages injoignables » et `performance.mjs` a chronométré `/fr/fr/dashboard`,
 * qui est un 404. Les deux fois, le rapport avait l'air d'un rapport.
 *
 * Ce que ce garde tient n'est pas une préférence de style : le contrôle
 * d'atterrissage de ces outils NE PEUT PAS voir ce défaut, puisqu'il compare
 * le chemin d'arrivée au chemin transformé, c'est-à-dire à lui-même. Il faut
 * donc l'empêcher à l'écriture.
 */

const SCRIPTS = join(process.cwd(), "scripts");

/**
 * Ce qui est dispensé, avec sa raison.
 *
 * `langue.mjs` PORTE la règle : c'est le seul endroit où `argv` se découpe.
 */
const DISPENSES: Record<string, string> = {
  "langue.mjs": "porte la règle : c'est lui qui écarte les drapeaux",
};

function fichiers(): string[] {
  return readdirSync(SCRIPTS).filter((f) => f.endsWith(".mjs"));
}

describe("les outils de mesure lisent leurs arguments de la même façon", () => {
  it("examine tous les scripts, et il y en a", () => {
    // Sans ce témoin, un dossier renommé rendrait les contrôles suivants
    // verts en n'ouvrant aucun fichier.
    expect(fichiers().length).toBeGreaterThanOrEqual(6);
  });

  it("aucun ne lit un argument par son rang sans écarter les drapeaux", () => {
    const fautifs = fichiers()
      .filter((f) => !DISPENSES[f])
      .filter((f) => /process\.argv\s*\[\s*[2-9]/.test(readFileSync(join(SCRIPTS, f), "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("celui qui lit une langue passe par le drapeau commun", () => {
    /**
     * `accessibilite.mjs` la prenait NUE, en troisième position. Quatre outils
     * qui prennent la même chose de deux façons finissent par diverger, et
     * c'est celui qui s'en sert le moins souvent qui garde l'ancienne.
     */
    const fautifs = fichiers()
      .filter((f) => !DISPENSES[f])
      .map((f) => [f, readFileSync(join(SCRIPTS, f), "utf8")] as const)
      .filter(([, texte]) => /langue/i.test(texte) && texte.includes("LANGUES"))
      .filter(([, texte]) => !texte.includes("langueDemandee(process.argv)"))
      .map(([f]) => f);
    expect(fautifs).toEqual([]);
  });

  it("la dispense désigne encore un fichier vivant", () => {
    // Une dispense qui ne désigne plus rien est du code mort qu'on a admis.
    const presents = new Set(fichiers());
    expect(Object.keys(DISPENSES).filter((f) => !presents.has(f))).toEqual([]);
  });
});
