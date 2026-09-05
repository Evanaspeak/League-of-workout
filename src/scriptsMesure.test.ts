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

/**
 * Les arguments de chaque appel à `nom`, parenthèses ÉQUILIBRÉES.
 *
 * Un `[^)]*` s'arrête à la première parenthèse fermante : sur
 * `enLangue(langueDemandee(process.argv), refuserPrefixe(x))` il ne rend que
 * le premier argument, et le contrôle passe à côté du second — c'est-à-dire
 * du chemin, qui est tout le sujet.
 */
export function argumentsDe(texte: string, nom: string): string[] {
  const out: string[] = [];
  const motif = new RegExp(`\\b${nom}\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = motif.exec(texte))) {
    let profondeur = 1;
    let i = m.index + m[0].length;
    const debut = i;
    while (i < texte.length && profondeur > 0) {
      if (texte[i] === "(") profondeur++;
      else if (texte[i] === ")") profondeur--;
      i++;
    }
    out.push(texte.slice(debut, i - 1));
  }
  return out;
}

/**
 * L'outil prend-il un chemin de page depuis la ligne de commande ?
 *
 * On suit un SAUT : les identifiants affectés depuis `positionnels`, puis
 * ceux affectés depuis une expression qui en contient un. Si l'un d'eux
 * arrive dans un appel à `enLangue`, le chemin vient de l'extérieur.
 */
export function prendUnCheminEnLigneDeCommande(texte: string): boolean {
  const noms = new Set<string>();
  for (const ligne of texte.split("\n")) {
    if (!/\bpositionnels\b/.test(ligne)) continue;
    for (const m of ligne.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) noms.add(m[1]);
  }
  for (const ligne of texte.split("\n")) {
    if (![...noms].some((n) => ligne.includes(n))) continue;
    const decl = ligne.match(/const\s+([A-Z][A-Z0-9_]{2,})\s*=/);
    if (decl) noms.add(decl[1]);
  }
  for (const args of argumentsDe(texte, "enLangue")) {
    if (/\bpositionnels\b/.test(args)) return true;
    if ([...noms].some((n) => new RegExp(`\\b${n}\\b`).test(args))) return true;
  }
  return false;
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

  it("celui qui prend un CHEMIN en ligne de commande refuse un préfixe de langue", () => {
    /**
     * `enLangue` pose le préfixe elle-même, donc `/fr/dashboard` devient
     * `/fr/fr/dashboard` — un 404 sur lequel l'outil rend d'excellents
     * chiffres. Le contrôle d'atterrissage ne peut pas le voir : il compare
     * le chemin d'arrivée au chemin transformé, c'est-à-dire à lui-même.
     *
     * Je suis tombé dedans deux fois, la seconde après l'avoir écrit au
     * journal. Une leçon qu'on écrit sans la fermer se retombe dedans.
     *
     * Le discriminant n'est PAS « emploie `enLangue` » : `accessibilite.mjs`
     * et `comparer-rendu.mjs` l'emploient sur une liste de pages écrite dans
     * le script, où personne ne peut glisser un préfixe. Ce qui distingue,
     * c'est que le chemin vienne de la LIGNE DE COMMANDE — et ça se suit :
     * un identifiant affecté depuis `positionnels`, ou depuis une expression
     * qui en contient un, puis passé à `enLangue`.
     */
    const concernes = fichiers()
      .filter((f) => !DISPENSES[f])
      .map((f) => [f, readFileSync(join(SCRIPTS, f), "utf8")] as const)
      .filter(([, texte]) => prendUnCheminEnLigneDeCommande(texte));
    // Sans ce témoin, un renommage viderait la liste et le contrôle passerait
    // au vert en n'examinant aucun outil.
    expect(concernes.length).toBeGreaterThanOrEqual(2);
    const fautifs = concernes.filter(([, t]) => !t.includes("refuserPrefixe(")).map(([f]) => f);
    expect(fautifs).toEqual([]);
  });

  it("la dispense désigne encore un fichier vivant", () => {
    // Une dispense qui ne désigne plus rien est du code mort qu'on a admis.
    const presents = new Set(fichiers());
    expect(Object.keys(DISPENSES).filter((f) => !presents.has(f))).toEqual([]);
  });
});
