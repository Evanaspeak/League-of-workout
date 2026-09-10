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

/**
 * Le corps des fonctions déclarées DANS le fichier, par nom.
 *
 * Un marqueur rangé dans un helper local est invisible à une lecture ligne à
 * ligne : `refus-silencieux.spec.ts` factorise son attente dans
 * `messageDEchec`, qui fait `toBeVisible()`, et le garde ne voyait qu'un
 * appel. C'est un FAUX POSITIF, c'est-à-dire la façon dont un garde se fait
 * dispenser — sept fichiers de `e2e/` portent à la fois un helper local et un
 * contrôle d'absence, donc la classe n'est pas propre à un fichier.
 *
 * Le garde suit UN saut, pas davantage : au-delà il ne dirait plus rien de
 * précis, et c'est la borne déjà posée pour le contrat du pont et pour le
 * garde du nom publié.
 */
function helpersLocaux(source: string): Map<string, { corps: string; de: number; a: number }> {
  const out = new Map<string, { corps: string; de: number; a: number }>();
  const decl = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(?:^|\n)\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  for (const m of source.matchAll(decl)) {
    const nom = m[1] ?? m[2];
    // Le corps s'arrête à l'accolade équilibrée, pas à la déclaration
    // suivante : deux helpers voisins se recouvriraient.
    const debut = source.indexOf("{", m.index! + m[0].length - 1);
    if (debut < 0) continue;
    let d = 0;
    let j = debut;
    for (; j < source.length; j++) {
      if (source[j] === "{") d++;
      else if (source[j] === "}" && --d === 0) break;
    }
    // La plage part de la DÉCLARATION et non de l'accolade : sinon la ligne
    // `async function voir(page) {` reste dans la fenêtre du voisin, et son
    // NOM suffit à déclencher le saut — un helper déclaré à côté calmerait
    // alors le garde sans avoir été appelé.
    const de = m.index! + (source[m.index!] === "\n" ? 1 : 0);
    out.set(nom, { corps: source.slice(debut, j + 1), de, a: j + 1 });
  }
  return out;
}

/** Les absences trouvées : {fichier, ligne, marqueur trouvé ou non}. */
function absences(source: string) {
  const masque = masquerCommentaires(source);
  const helpers = helpersLocaux(masque);
  const lignes = masque.split("\n");

  /**
   * La fenêtre lit du code EXÉCUTÉ, jamais une déclaration voisine.
   *
   * Sans ça, un helper déclaré douze lignes plus haut calme le garde par le
   * simple fait que son texte tombe dans la fenêtre — c'est-à-dire qu'un
   * fichier qui range une attente dans un helper se garde tout seul, quel que
   * soit l'ordre. Le cas fabriqué des deux voisins le montre : `poser`
   * n'attend rien, et il héritait du `toBeVisible` de `voir`.
   *
   * Les lignes d'un helper sont donc blanchies POUR LES AUTRES, et gardées
   * pour lui-même : un contrôle d'absence écrit à l'intérieur d'un helper
   * doit continuer de voir ce qui le précède dans ce helper.
   */
  const debutDeLigne: number[] = [];
  for (let d = 0, k = 0; k < lignes.length; k++) { debutDeLigne.push(d); d += lignes[k].length + 1; }
  const horsDes = (i: number) => {
    const pos = debutDeLigne[i];
    return lignes.map((l, k) => {
      const p = debutDeLigne[k];
      const dedans = [...helpers.values()].some((h) => p >= h.de && p < h.a);
      const memeQueMoi = [...helpers.values()].some((h) => p >= h.de && p < h.a && pos >= h.de && pos < h.a);
      return dedans && !memeQueMoi ? "" : l;
    });
  };
  const out: { ligne: number; garde: boolean }[] = [];
  for (let i = 0; i < lignes.length; i++) {
    // L'assertion se coupe volontiers en deux : `.toHaveCount(0)` passe à la
    // ligne. On ancre sur le nom, et on recolle vers l'AVANT — recoller vers
    // l'arrière ferait détecter la même absence deux fois, et l'attribuerait
    // à la ligne d'avant dès qu'elle porte un `expect(`.
    if (!lignes[i].includes("toHaveCount")) continue;
    const bloc = lignes[i] + "\n" + (lignes[i + 1] ?? "");
    if (!/toHaveCount\(\s*0\s*\)/.test(bloc)) continue;
    const avant = horsDes(i).slice(Math.max(0, i - FENETRE), i).join("\n");
    const porteUnMarqueur = (t: string) => MARQUEURS.some((m) => t.includes(m));
    // Un appel à un helper local vaut le marqueur qu'il CONTIENT — pas son
    // nom : un helper qui n'attend rien ne garde rien, et le cas fabriqué
    // le vérifie.
    const parSaut = [...avant.matchAll(/\b(\w+)\s*\(/g)]
      .some((a) => helpers.has(a[1]) && porteUnMarqueur(helpers.get(a[1])!.corps));
    out.push({ ligne: i + 1, garde: porteUnMarqueur(avant) || parSaut });
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

  it("le saut vaut par ce que le helper CONTIENT, pas par son nom", () => {
    /**
     * Les deux moitiés comptent, et il faut les deux : sans la première, un
     * marqueur factorisé passerait pour absent — c'est le faux positif qui a
     * motivé le saut. Sans la seconde, n'importe quel appel calmerait le
     * garde, et il ne garderait plus rien.
     */
    const attend = [
      "async function voir(page) {",
      "  await expect(page.getByRole('alert')).toBeVisible();",
      "}",
      "await voir(page);",
      "await expect(page.locator('.y')).toHaveCount(0);",
    ].join("\n");
    expect(absences(attend)).toEqual([{ ligne: 5, garde: true }]);

    const nAttendRien = [
      "async function poser(page) {",
      "  await page.goto('/x');",
      "}",
      "await poser(page);",
      "await expect(page.locator('.y')).toHaveCount(0);",
    ].join("\n");
    expect(absences(nAttendRien)).toEqual([{ ligne: 5, garde: false }]);
  });

  it("le corps d'un helper s'arrête à son accolade, pas au helper suivant", () => {
    // Un découpage qui déborderait ferait hériter à `poser` le marqueur de
    // son VOISIN, donc calmerait le garde sur un helper qui n'attend rien.
    const voisins = [
      "async function poser(page) {",
      "  await page.goto('/x');",
      "}",
      "async function voir(page) {",
      "  await expect(page.getByRole('alert')).toBeVisible();",
      "}",
      "await poser(page);",
      "await expect(page.locator('.y')).toHaveCount(0);",
    ].join("\n");
    expect(absences(voisins)).toEqual([{ ligne: 8, garde: false }]);
  });
});
