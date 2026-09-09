import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Ce que la supervision LIT, et ce que la sonde REND.
 *
 * `/api/sante` est la seule chose du système qui crie, et son unique lecteur
 * est `.github/workflows/supervision.yml`. Entre les deux, il n'y a que du
 * JSON : ni type, ni import, ni compilateur. Un champ renommé dans la route ne
 * fait échouer ni la construction ni un test, et `jq` rend simplement une
 * chaîne vide.
 *
 * Le mode de panne qui en découle est le plus coûteux des deux, et le workflow
 * porte en commentaire le jour où il est arrivé pour une autre raison : `.ok`
 * qui ne vaut plus « true » fait partir l'alerte À CHAQUE PASSAGE, sur un site
 * en parfaite santé. Une supervision qui crie au loup finit par ne plus être
 * lue, ce qui est pire que pas de supervision du tout.
 *
 * Ce qui ne peut pas s'importer se COMPARE — la règle est déjà celle du pont
 * Electron, des six langues de la coquille et de la table des processus
 * surveillés.
 */

const RACINE = process.cwd();
const WORKFLOW = join(RACINE, ".github/workflows/supervision.yml");
const ROUTE = join(RACINE, "src/app/api/sante/route.ts");

/** Les champs que le workflow va chercher dans la réponse, par `jq`. */
function champsLus(): string[] {
  const yml = readFileSync(WORKFLOW, "utf8");
  const trouves = new Set<string>();
  for (const m of yml.matchAll(/lire\s+"\$corps"\s+'\.([A-Za-z_][A-Za-z0-9_]*)'/g)) {
    trouves.add(m[1]);
  }
  return [...trouves].sort();
}

/**
 * Les clés de l'objet que la route rend.
 *
 * On lit le littéral `const corps = { … }` plutôt que d'appeler la route : ce
 * qu'on veut savoir est ce qu'elle PROMET, pas ce qu'un jeu de données
 * particulier en fait sortir. Le source est privé de ses commentaires — celui
 * de la route nomme les champs pour les expliquer.
 */
function champsRendus(): string[] {
  const src = sansCommentaires(readFileSync(ROUTE, "utf8"));
  const debut = src.indexOf("const corps = {");
  expect(debut).toBeGreaterThan(-1);
  let profondeur = 0;
  let fin = -1;
  for (let i = src.indexOf("{", debut); i < src.length; i++) {
    if (src[i] === "{") profondeur++;
    else if (src[i] === "}" && --profondeur === 0) { fin = i; break; }
  }
  expect(fin).toBeGreaterThan(debut);
  const bloc = src.slice(debut, fin);
  /**
   * Le motif regarde AUTOUR de la clé sans la consommer.
   *
   * Écrit `[{,]\s*(nom)\s*[:,]`, il avale la virgule finale : deux raccourcis
   * d'objet qui se suivent — `base,` puis `ms,` — se chevauchent, et
   * `matchAll` ne rend que le premier. Le garde a donc accusé, à sa première
   * exécution, un champ parfaitement rendu. C'est le piège déjà payé sur le
   * recensement du filtrage par compte, où `where: { id, userId }` échappait
   * pour la même raison.
   */
  const cles = new Set<string>();
  for (const m of bloc.matchAll(/(?<=[{,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?=[:,}])/g)) {
    if (m[1] !== "corps") cles.add(m[1]);
  }
  return [...cles].sort();
}

describe("contrat entre la sonde de santé et la supervision", () => {
  it("la sonde rend tout ce que la supervision lit", () => {
    const lus = champsLus();
    const rendus = champsRendus();
    const manquants = lus.filter((c) => !rendus.includes(c));
    expect({ manquants, lus, rendus }).toEqual({ manquants: [], lus, rendus });
  });

  it("examine réellement les deux côtés", () => {
    // Sans ce témoin, un motif devenu aveugle rendrait deux listes vides —
    // qui s'accordent parfaitement, et ne prouvent plus rien.
    expect(champsLus().length).toBeGreaterThanOrEqual(3);
    expect(champsRendus().length).toBeGreaterThanOrEqual(4);
  });

  it("la supervision exige le code HTTP autant que le corps", () => {
    // Les deux ensemble, sinon un 200 sur une base morte suffirait à la faire
    // taire — ou un 503 sur un corps sain à la faire crier.
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toMatch(/\[\s*"\$code"\s*=\s*"200"\s*\][^\n]*&&[^\n]*lire\s+"\$corps"\s+'\.ok'/);
  });

  it("la sonde fait varier son code avec l'état de la base", () => {
    // Un statut figé à 200 laisserait la supervision muette sur une base
    // morte, et le corps seul ne suffit pas : le workflow regarde d'abord le
    // code.
    const src = sansCommentaires(readFileSync(ROUTE, "utf8"));
    expect(src).toMatch(/const statut = [^;]*\b503\b/);
    expect(src).toMatch(/status: (?:cache\.statut|statut)/);
  });
});
