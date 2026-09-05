import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * La dette s'affiche dans la langue de qui la lit.
 *
 * C'est le nombre le plus important du produit : ce qu'on doit. Il sortait de
 * `formaterCompact` et de `ventiler`, qui écrivaient « 1000 » et « 2,4 km »
 * dans les six langues — le français attend « 1 000 », l'allemand « 1.000 »,
 * l'anglais « 1,000 » et « 2.4 km ». Le point décimal n'est pas une
 * coquetterie : en allemand c'est le séparateur des MILLIERS.
 *
 * Ces quatre fonctions prennent donc une étiquette de langue, et le contrôle
 * porte sur l'APPEL et non sur l'import. Un fichier qui importe `useDateLocale`
 * sans le passer à l'appel a l'intention et pas le comportement — c'est le
 * défaut déjà écrit au journal pour le garde du nom publié et pour celui de la
 * porte des routes.
 *
 * L'étiquette est OPTIONNELLE dans la signature, et elle doit le rester : elle
 * a permis de reprendre la quinzaine d'appelants un par un sans qu'aucun écran
 * ne change avant d'avoir été vérifié. C'est ce test, et lui seul, qui fait
 * qu'elle n'est pas facultative en pratique.
 */

const SRC = join(process.cwd(), "src");

/** Le module qui PORTE les fonctions : il les définit, il ne les appelle pas. */
const PORTE_LES_FONCTIONS = "lib/exercices.ts";

/** Combien d'arguments un appel doit porter pour que la langue y figure. */
export const ARITE_ATTENDUE: Record<string, number> = {
  formaterDuree: 2,      // (secondes, etiquette)
  formaterCompact: 4,    // (points, exercice, ratios, etiquette)
  formaterQuantite: 3,   // (quantite, exercice, etiquette)
  ventiler: 3,           // (parExercice, ratios, etiquette)
  /**
   * Le temps de JEU, ajouté après les quatre autres : il écrivait « 1 h 15 »
   * et « 27 min » dans les six langues, sur les cartes et le tableau de
   * l'historique, chez tous ceux qui jouent aux cinq jeux du catalogue comptés
   * au TEMPS. Le comparatif de jeux, lui, reçoit un formateur DÉJÀ lié à la
   * langue et l'appelle sous un autre nom — sans quoi ce contrôle déclarerait
   * fautif un appel parfaitement juste.
   */
  formaterTempsJeu: 2,   // (secondes, etiquette)
};

/**
 * Les arguments de PREMIER niveau d'un appel, depuis sa parenthèse ouvrante.
 *
 * Il faut compter les niveaux plutôt que découper sur les virgules : la
 * moitié de ces appels portent un objet, un gabarit ou un appel imbriqué, et
 * un découpage naïf annoncerait cinq arguments là où il y en a deux. Rend
 * `null` quand la parenthèse ne se referme pas — un fichier tronqué ne doit
 * pas passer pour un appel conforme.
 */
export function argumentsDe(texte: string, ouvrante: number): string[] | null {
  const args: string[] = [];
  let courant = "";
  let profondeur = 0;
  let guillemet: string | null = null;
  for (let i = ouvrante + 1; i < texte.length; i += 1) {
    const c = texte[i];
    if (guillemet) {
      courant += c;
      if (c === "\\") { courant += texte[i + 1] ?? ""; i += 1; continue; }
      if (c === guillemet) guillemet = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { guillemet = c; courant += c; continue; }
    if (c === "(" || c === "[" || c === "{") { profondeur += 1; courant += c; continue; }
    if (c === ")" && profondeur === 0) {
      if (courant.trim() !== "" || args.length > 0) args.push(courant.trim());
      return args;
    }
    if (c === ")" || c === "]" || c === "}") { profondeur -= 1; courant += c; continue; }
    if (c === "," && profondeur === 0) { args.push(courant.trim()); courant = ""; continue; }
    courant += c;
  }
  return null;
}

function fichiersSource(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "generated") continue;
    const c = join(dossier, e.name);
    if (e.isDirectory()) fichiersSource(c, out);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(c);
  }
  return out;
}

function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

describe("les quantités d'effort portent la langue de qui les lit", () => {
  const tous = fichiersSource(SRC);

  it("découpe les arguments d'un appel, imbrications comprises", () => {
    // Éprouvé sur des cas FABRIQUÉS : les fichiers réels ne contiennent que
    // des cas que le découpage accepte, donc ils ne le distinguent pas d'un
    // découpage cassé. C'est la méthode qui a donné ses dents au
    // discriminant des longueurs CSS, et à `porteUnFiltre` avant lui.
    expect(argumentsDe("f(a, b)", 1)).toEqual(["a", "b"]);
    expect(argumentsDe("f(g(a, b), c)", 1)).toEqual(["g(a, b)", "c"]);
    expect(argumentsDe("f({ x: 1, y: 2 }, c)", 1)).toEqual(["{ x: 1, y: 2 }", "c"]);
    expect(argumentsDe("f(`a, b`, c)", 1)).toEqual(["`a, b`", "c"]);
    expect(argumentsDe("f()", 1)).toEqual([]);
    // Une parenthèse qui ne se referme pas n'est pas un appel conforme.
    expect(argumentsDe("f(a, b", 1)).toBeNull();
  });

  it("passe l'étiquette de langue à chaque appel", () => {
    const fautifs: string[] = [];
    let examines = 0;
    const fichiersVus = new Set<string>();

    for (const f of tous) {
      const rel = relative(SRC, f).split("\\").join("/");
      if (rel === PORTE_LES_FONCTIONS) continue;
      const texte = sansCommentaires(readFileSync(f, "utf8"));
      for (const [nom, arite] of Object.entries(ARITE_ATTENDUE)) {
        for (const m of texte.matchAll(new RegExp(`\\b${nom}\\s*\\(`, "g"))) {
          const args = argumentsDe(texte, m.index + m[0].length - 1);
          examines += 1;
          fichiersVus.add(rel);
          const ligne = texte.slice(0, m.index).split("\n").length;
          if (args === null || args.length < arite) {
            fautifs.push(`${rel}:${ligne} — ${nom} reçoit ${args?.length ?? "?"} arguments sur ${arite}`);
          }
        }
      }
    }

    // Deux témoins. Sans le premier, un dossier renommé rendrait le contrôle
    // vert sur zéro appel lu. Sans le second, la règle passerait pour tenue
    // alors qu'elle n'aurait été vérifiée que sur les écrans : la moitié du
    // sujet est côté SERVEUR — l'image de saison, la source de diffusion et
    // les deux notifications, qui ont la langue du compte sous la main et ne
    // peuvent appeler aucun crochet React.
    expect(examines).toBeGreaterThan(20);
    expect([...fichiersVus].filter((r) => r.startsWith("app/api/")).length).toBeGreaterThan(2);
    expect(fautifs).toEqual([]);
  });
});
