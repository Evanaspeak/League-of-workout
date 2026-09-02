/**
 * Un garde qui ne lit rien passe au vert.
 *
 * C'est la forme d'erreur la plus fréquente de ce projet, et elle est
 * particulièrement traître ici : les gardes structurels regardent un DOSSIER
 * plutôt qu'une liste écrite à la main — ce qui est leur qualité, puisqu'ils
 * voient ainsi le fichier qu'on ajoutera demain. Le prix, c'est qu'un dossier
 * renommé, un motif devenu aveugle ou une extension qui change les rend muets
 * sans rien casser : `expect(fautifs).toEqual([])` est vrai sur une liste
 * vide, et rien ne distingue « rien à signaler » de « rien regardé ».
 *
 * Vingt-deux gardes sur vingt-six portaient déjà leur témoin. Les quatre
 * autres ont été trouvés en recensant plutôt qu'en s'en souvenant.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const RACINE = join(__dirname, "..");

function testsDe(dossier: string, out: string[] = []): string[] {
  for (const f of readdirSync(dossier)) {
    if (f === "node_modules" || f === "generated" || f.startsWith(".")) continue;
    const p = join(dossier, f);
    if (statSync(p).isDirectory()) testsDe(p, out);
    else if (/\.(test|spec)\.[jt]sx?$/.test(f)) out.push(p);
  }
  return out;
}

/** Ce qui trahit un garde structurel : il parcourt le disque. */
const PARCOURT = /\breaddirSync\b|\bglobSync\b|ls-files/;

/**
 * Ce qui fait un témoin : une assertion qui refuse d'avoir lu zéro chose.
 * Une comparaison à une liste vide n'en est pas un — c'est précisément ce
 * qu'un garde muet rend.
 */
const TEMOIN = /toBeGreaterThan(?:OrEqual)?\(|not\.toHaveLength\(0\)|\.length\)\.toBe\(/;

/**
 * `logosJeux.test.ts` DOUBLE `readdirSync` au lieu de lire le disque : il
 * fournit lui-même la liste des fichiers, cas par cas. Un témoin n'y aurait
 * rien à mesurer — le test ne dépend d'aucun dossier réel.
 */
const EXEMPTS: Record<string, string> = {
  "src/lib/logosJeux.test.ts": "double readdirSync, ne lit aucun dossier réel",
};

describe("les gardes structurels", () => {
  const gardes = [...testsDe(join(RACINE, "src")), ...testsDe(join(RACINE, "desktop", "src")),
    ...testsDe(join(RACINE, "e2e"))]
    .map((p) => relative(RACINE, p).split("\\").join("/"))
    .filter((rel) => PARCOURT.test(readFileSync(join(RACINE, rel), "utf8")));

  it("s'en trouve à examiner", () => {
    // Le garde des gardes a le même angle mort que ceux qu'il surveille.
    expect(gardes.length).toBeGreaterThanOrEqual(20);
  });

  it("portent tous un témoin de non-vacuité", () => {
    const sansTemoin = gardes
      .filter((rel) => !(rel in EXEMPTS))
      .filter((rel) => !TEMOIN.test(readFileSync(join(RACINE, rel), "utf8")));
    expect(sansTemoin).toEqual([]);
  });

  it("n'a pas d'exemption qui ne désigne plus rien", () => {
    for (const rel of Object.keys(EXEMPTS)) expect(gardes).toContain(rel);
  });
});
