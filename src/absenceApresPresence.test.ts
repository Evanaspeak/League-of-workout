import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Les commentaires masqués PAR DES ESPACES, sauts de ligne préservés.
 *
 * `sansCommentaires` ne convient pas ici : elle supprime le contenu des blocs
 * `/* … *\/` sauts de ligne compris, donc tout numéro de ligne rapporté après
 * un tel bloc est faux — et ces fichiers en sont pleins. Un garde qui désigne
 * la mauvaise ligne envoie corriger ailleurs.
 */
function masquerCommentaires(source: string): string {
  let out = "";
  let i = 0;
  const garder = (c: string) => { out += c === "\n" ? "\n" : " "; };
  while (i < source.length) {
    const c = source[i];
    const d = source[i + 1];
    if (c === "/" && d === "/") {
      while (i < source.length && source[i] !== "\n") { garder(source[i]); i++; }
      continue;
    }
    if (c === "/" && d === "*") {
      garder(c); garder(d); i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) { garder(source[i]); i++; }
      if (i < source.length) { garder("*"); garder("/"); i += 2; }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      out += c; i++;
      while (i < source.length && source[i] !== c) {
        if (source[i] === "\\") { out += source[i]; i++; }
        if (i < source.length) { out += source[i]; i++; }
      }
      if (i < source.length) { out += source[i]; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

/**
 * `toHaveCount(0)` est la seule assertion de Playwright que l'ABSENCE
 * satisfait. Elle rend la main dès que le compte vaut zéro — donc avant que
 * la page soit hydratée, avant que la requête soit partie, avant que le
 * composant existe. Un contrôle d'absence posé trop tôt ne prouve rien, et il
 * a exactement l'allure d'un contrôle qui prouve quelque chose.
 *
 * Ce n'est pas une crainte : `e2e/force.spec.ts` en portait un, et il ne
 * tenait que par l'ORDONNANCEMENT. La lecture en base qui le précédait
 * laissait à `/api/settings` le temps de répondre ; avec la courbe rendue dès
 * zéro point, le test tombait dans cet ordre et PASSAIT dans l'autre. Mesuré
 * des deux côtés avant d'écrire une ligne.
 *
 * La règle : un contrôle d'absence doit être précédé, dans les douze lignes
 * qui le précèdent, d'une attente ou d'une assertion POSITIVE — quelque chose
 * qui prouve que l'état visé est atteint. Après, l'absence dit quelque chose.
 *
 * Ce que le garde ne peut PAS faire, et c'est écrit plutôt que tu : il ne
 * juge pas si le marqueur porte sur la bonne ZONE. Un `toBeVisible` sur le
 * pied de page satisferait la règle sans rien prouver du panneau qu'on
 * regarde. Ce qui l'attrape est le sabotage, et il se fait à la main.
 */

const E2E = path.join(process.cwd(), "e2e");

/** Ce qui prouve qu'on est arrivé quelque part, par opposition à ne rien trouver. */
const MARQUEURS = [
  "toBeVisible(",
  "toBeAttached(",
  "toBeChecked(",
  "toBeFocused(",
  "toContainText(",
  "toHaveText(",
  "toHaveValue(",
  "toHaveAttribute(",
  "toHaveURL(",
  "waitFor(",
  "waitForURL(",
  "waitForSelector(",
  "waitForFunction(",
  "expect.poll(",
];

const FENETRE = 12;

function fichiers(): string[] {
  return readdirSync(E2E).filter((f) => f.endsWith(".ts")).map((f) => path.join(E2E, f));
}

/** Les absences trouvées : {fichier, ligne, marqueur trouvé ou non}. */
function absences(source: string) {
  const lignes = masquerCommentaires(source).split("\n");
  const out: { ligne: number; garde: boolean }[] = [];
  for (let i = 0; i < lignes.length; i++) {
    // L'assertion se coupe volontiers en deux : `.toHaveCount(0)` passe à la
    // ligne. On ancre sur le nom, et on recolle vers l'AVANT — recoller vers
    // l'arrière ferait détecter la même absence deux fois, et l'attribuerait
    // à la ligne d'avant dès qu'elle porte un `expect(`.
    if (!lignes[i].includes("toHaveCount")) continue;
    const bloc = lignes[i] + "\n" + (lignes[i + 1] ?? "");
    if (!/toHaveCount\(\s*0\s*\)/.test(bloc)) continue;
    const avant = lignes.slice(Math.max(0, i - FENETRE), i).join("\n");
    out.push({ ligne: i + 1, garde: MARQUEURS.some((m) => avant.includes(m)) });
  }
  return out;
}

describe("un contrôle d'absence vient APRÈS un marqueur de présence", () => {
  const tous = fichiers().flatMap((f) =>
    absences(readFileSync(f, "utf8")).map((a) => ({ ...a, f: path.basename(f) })));

  it("le recensement trouve des contrôles d'absence", () => {
    // Sans ce témoin, un motif devenu aveugle rendrait le test vert sur une
    // liste vide, ce qui est exactement la forme d'erreur qu'il surveille.
    expect(tous.length).toBeGreaterThanOrEqual(10);
  });

  it("chacun est précédé d'une attente ou d'une assertion positive", () => {
    const nus = tous.filter((a) => !a.garde).map((a) => `${a.f}:${a.ligne}`);
    expect(nus).toEqual([]);
  });

  it("le retrait des commentaires ne fabrique pas de faux marqueurs", () => {
    /**
     * Les commentaires de ces fichiers CITENT abondamment les motifs qu'on
     * cherche — `recuperation.spec.ts` écrit noir sur blanc pourquoi
     * `toHaveCount(0)` est vrai tout de suite. Lu tel quel, un commentaire
     * qui nomme `toBeVisible` calmerait le garde sur un contrôle qui n'a
     * aucun marqueur. Le test le prouve sur un cas fabriqué.
     */
    const fabrique = [
      "await page.goto('/x');",
      "// on attend d'abord toBeVisible sur le panneau",
      "await expect(page.locator('.y')).toHaveCount(0);",
    ].join("\n");
    expect(absences(fabrique)).toEqual([{ ligne: 3, garde: false }]);
  });

  it("un marqueur réel, lui, satisfait la règle", () => {
    const sain = [
      "await expect(page.getByRole('button')).toBeVisible();",
      "await expect(page.locator('.y')).toHaveCount(0);",
    ].join("\n");
    expect(absences(sain)).toEqual([{ ligne: 2, garde: true }]);
  });
});
