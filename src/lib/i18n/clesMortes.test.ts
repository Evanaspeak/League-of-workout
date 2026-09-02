/**
 * Une clé de dictionnaire que personne ne lit.
 *
 * `dictionaries.test.ts` refuse un FICHIER de dictionnaire que rien n'importe —
 * deux avaient survécu six semaines à la suppression de leurs écrans, et
 * avaient été traduits en quatre langues de plus avant qu'on s'en aperçoive. Il
 * ne dit rien des clés à l'intérieur d'un fichier bien vivant, et c'est là que
 * la même chose se produit en plus discret : un écran qu'on remanie laisse ses
 * anciens libellés derrière lui, dans les six langues.
 *
 * Le coût est humain, pas technique. TypeScript ne se plaint pas d'une clé que
 * personne ne lit, et le paquet livré ne s'en allège pas non plus : elle part
 * au navigateur avec les autres. On la traduit, on la relit, on la corrige.
 *
 * L'inverse — une clé EMPLOYÉE que personne ne déclare — est attrapé par
 * TypeScript ici, ce qui n'était pas le cas de la coquille Electron : là-bas
 * il a fallu un test, et « undefined » s'écrivait en travers de la pastille.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { EXERCICE_IDS } from "@/lib/exercices";

const RACINE = join(__dirname, "..", "..", "..");
const DICOS = join(RACINE, "src", "lib", "i18n", "dictionaries");

/**
 * Clés employées AUTREMENT que par leur nom.
 *
 * Vide aujourd'hui, et c'est le bon état : une exemption est une dette. Chacune
 * doit porter sa raison, et une liste qui s'allonge dit que le recensement ne
 * sait plus lire le code.
 */
const EXEMPTIONS: Record<string, string> = {};

/**
 * Clés CONSTRUITES au vol, que le nom seul ne peut pas trouver.
 *
 * `nomsExercices` lit `${id}Nom` et `${id}Desc` pour chaque exercice du
 * catalogue : douze clés bien vivantes qu'un recensement par le nom déclare
 * mortes. Le premier passage de ce garde a failli les faire supprimer — et
 * c'est `nomsExercices.test.ts` qui a arrêté le geste, en exigeant un nom et
 * une description pour chaque exercice. Un recensement qui ne connaît qu'une
 * façon de lire une clé propose de supprimer du texte vivant.
 *
 * La liste des identifiants vient du catalogue, jamais d'une copie : un
 * exercice ajouté demain entre dans la règle tout seul.
 */
function construiteAuVol(k: string): boolean {
  return EXERCICE_IDS.some((id) => k === `${id}Nom` || k === `${id}Desc`);
}

function fichiers(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

/**
 * Les clés de PREMIER niveau d'un bloc de langue.
 *
 * Il faut sauter les chaînes et les commentaires : un texte français contient
 * « Actuellement : », et un motif naïf en fait une clé. La première version de
 * ce recensement en a inventé une trentaine, toutes des morceaux de phrases —
 * et une clé inventée envoie supprimer du texte bien vivant.
 */
function clesDuBloc(src: string, debut: number): Set<string> {
  const cles = new Set<string>();
  let i = src.indexOf("{", debut);
  let prof = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const fin = c;
      i++;
      while (i < src.length && src[i] !== fin) { if (src[i] === "\\") i++; i++; }
      continue;
    }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (c === "{" || c === "(" || c === "[") { prof++; continue; }
    if (c === "}" || c === ")" || c === "]") { prof--; if (prof === 0) break; continue; }
    if (prof === 1 && /[A-Za-z_]/.test(c)) {
      const m = /^([A-Za-z_]\w*)\s*:/.exec(src.slice(i));
      if (m) { cles.add(m[1]); i += m[1].length; }
      else { const w = /^\w+/.exec(src.slice(i)); i += (w ? w[0].length : 1) - 1; }
    }
  }
  return cles;
}

/** Tout le code du projet, dictionnaires exclus. */
const code = [
  ...fichiers(join(RACINE, "src")),
  ...fichiers(join(RACINE, "e2e")),
]
  .filter((p) => !p.includes(join("i18n", "dictionaries")))
  .map((p) => readFileSync(p, "utf8"))
  .join("\n");

/**
 * Les trois façons dont une clé est lue : `t.cle`, une déstructuration
 * `const { cle } = …`, ou un accès par chaîne.
 */
function employee(k: string): boolean {
  return new RegExp(`\\.${k}\\b`).test(code)
    || new RegExp(`\\b${k}\\s*[,}]`).test(code)
    || new RegExp(`["'\`]${k}["'\`]`).test(code);
}

describe("clés de dictionnaire", () => {
  const dicos = readdirSync(DICOS).filter((f) => f.endsWith(".ts"));
  const parFichier = new Map<string, Set<string>>();
  for (const f of dicos) {
    const src = readFileSync(join(DICOS, f), "utf8");
    const debut = src.indexOf("fr: {");
    // Le bloc français fait foi : les tests de parité garantissent déjà que
    // les autres langues portent exactement les mêmes clés.
    if (debut !== -1) parFichier.set(f, clesDuBloc(src, debut));
  }

  /**
   * Sans témoin, un extracteur cassé — un bloc renommé, une accolade déplacée —
   * rendrait ce fichier vert en n'examinant aucune clé. C'est exactement la
   * forme d'erreur que ce garde existe pour empêcher.
   */
  it("en trouve à examiner", () => {
    expect(parFichier.size).toBeGreaterThanOrEqual(20);
    const total = [...parFichier.values()].reduce((n, s) => n + s.size, 0);
    expect(total).toBeGreaterThanOrEqual(800);
  });

  it("sont toutes lues quelque part", () => {
    const mortes: string[] = [];
    for (const [f, cles] of parFichier) {
      for (const k of cles) {
        if (k in EXEMPTIONS || construiteAuVol(k)) continue;
        if (!employee(k)) mortes.push(`${f} → ${k}`);
      }
    }
    expect(mortes).toEqual([]);
  });

  /**
   * Sans ce contrôle, une règle de construction qui ne désigne plus rien —
   * `nomsExercices` réécrit, le suffixe renommé — laisserait passer douze clés
   * mortes sans que personne ne le voie.
   */
  it("la règle des clés construites désigne encore des clés réelles", () => {
    const toutes = new Set([...parFichier.values()].flatMap((s) => [...s]));
    expect([...toutes].filter(construiteAuVol).length).toBeGreaterThanOrEqual(EXERCICE_IDS.length);
  });

  it("n'a pas d'exemption qui ne désigne plus rien", () => {
    // Une dispense qui ne correspond à aucune clé vivante est du code mort
    // qu'on a fini par admettre.
    const toutes = new Set([...parFichier.values()].flatMap((s) => [...s]));
    for (const k of Object.keys(EXEMPTIONS)) expect(toutes.has(k)).toBe(true);
  });
});
