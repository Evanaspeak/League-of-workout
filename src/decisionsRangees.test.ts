import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Une décision tranchée laisse une adresse, et l'adresse mène quelque part.
 *
 * `docs/questions-ouvertes.md` porte un tableau des questions parties : il
 * existe pour qu'une décision prise reste retrouvable, parce qu'une question
 * qui disparaît sans laisser d'adresse se repose six semaines plus tard.
 *
 * Il a menti dès sa première version. « L'historique grandit pour toujours »
 * y était rangé sous « plan, section Technique » — et **la ligne n'existait
 * pas dans le plan**. La décision était écrite, son adresse était écrite, et
 * il n'y avait rien au bout. Une adresse qu'on n'a pas vérifiée ne vaut pas
 * mieux que pas d'adresse : c'est pire, parce qu'on cesse de chercher.
 *
 * Ce contrôle ne juge pas ce qui est décidé. Il exige seulement que ce qui dit
 * « plan » désigne une ligne ou une étape qui existe.
 */

const RACINE = join(__dirname, "..");
const questions = readFileSync(join(RACINE, "docs/questions-ouvertes.md"), "utf8");
const plan = readFileSync(join(RACINE, "docs/plan-action.md"), "utf8");

/** Les destinations du tableau, c'est-à-dire la troisième colonne. */
function destinations(): string[] {
  const sortie: string[] = [];
  for (const ligne of questions.split("\n")) {
    if (!ligne.startsWith("| ")) continue;
    const cellules = ligne.split("|").map((c) => c.trim());
    // `| question | réponse | où |` : quatre morceaux plus deux vides aux bouts.
    if (cellules.length !== 5) continue;
    const ou = cellules[3];
    if (!ou || ou === "où" || /^-+$/.test(ou)) continue;
    sortie.push(ou);
  }
  return sortie;
}

/** Les réfs des lignes du plan, telles que ses tableaux les portent. */
function refsDuPlan(): Set<string> {
  const refs = new Set<string>();
  for (const ligne of plan.split("\n")) {
    const m = /^\| \[.\] \| ([\w-]+) \|/.exec(ligne);
    if (m) refs.add(m[1]);
  }
  return refs;
}

/** Les numéros d'étape, tels que les titres du plan les portent. */
function etapesDuPlan(): Set<string> {
  const etapes = new Set<string>();
  for (const m of plan.matchAll(/^### \[.\] (\d+) —/gm)) etapes.add(m[1]);
  return etapes;
}

describe("les décisions rangées", () => {
  const toutes = destinations();

  it("le tableau est lu", () => {
    // Sans témoin, un tableau renommé rendrait tout ce qui suit vert en
    // n'examinant aucune destination — l'angle mort exact qu'on ferme.
    expect(toutes.length).toBeGreaterThan(10);
  });

  /**
   * Ce qui dit « plan » nomme sa ligne ou son étape.
   *
   * « plan, section Technique » ne se vérifie pas : la section existait, la
   * ligne non. Un nom de section est une adresse approximative, et c'est
   * précisément l'approximation qui a laissé passer le trou.
   */
  it("une destination qui dit « plan » nomme une ligne ou une étape", () => {
    /*
      Pas de `\b` devant « étape » : le `\b` de JavaScript repose sur
      `[A-Za-z0-9_]`, donc « é » y est un caractère NON-mot et il n'y a aucune
      frontière entre l'espace qui précède et lui. Le motif ne trouvait jamais
      rien, et le contrôle accusait une destination parfaitement juste. C'est
      le piège déjà payé sur le garde du registre.
    */
    const nommeUneEtape = (d: string) => /(?:^|[^\p{L}\p{N}])étape \d+/u.test(d);
    const vagues = toutes.filter(
      (d) => /^plan\b/.test(d) && !/\bligne [\w-]+/.test(d) && !nommeUneEtape(d),
    );
    expect(vagues).toEqual([]);
  });

  it("chaque ligne nommée existe au plan", () => {
    const refs = refsDuPlan();
    expect(refs.size).toBeGreaterThan(100);
    const perdues: string[] = [];
    for (const d of toutes) {
      const m = /\bligne ([\w-]+)/.exec(d);
      if (m && !refs.has(m[1])) perdues.push(d);
    }
    expect(perdues).toEqual([]);
  });

  it("chaque étape nommée existe au plan", () => {
    const etapes = etapesDuPlan();
    expect(etapes.size).toBeGreaterThan(5);
    const perdues: string[] = [];
    for (const d of toutes) {
      const m = /(?:^|[^\p{L}\p{N}])étape (\d+)/u.exec(d);
      if (m && !etapes.has(m[1])) perdues.push(d);
    }
    expect(perdues).toEqual([]);
  });
});
