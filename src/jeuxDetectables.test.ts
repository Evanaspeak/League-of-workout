import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JEUX } from "@/lib/jeux";

/**
 * Chaque jeu du catalogue est détectable par l'application de bureau.
 *
 * La table des processus vit dans `desktop/src/jeuxProcessus.js`, et elle ne
 * peut PAS importer le catalogue : la coquille Electron se construit sans le
 * paquet du site. C'est la même situation que les six langues, recopiées dans
 * `desktop/src/langue.js` — et la même réponse, un test qui compare les deux.
 *
 * Ce qu'un oubli coûte : le jeu paraît au catalogue, dans le calculateur, sur
 * la bande de l'accueil, et l'application ne le voit jamais démarrer. Pas de
 * pastille, pas de session, pas d'enregistrement automatique. Le produit
 * promet une détection qu'il n'a pas, et rien ne le dit — c'est le pire genre
 * de défaut, celui qui n'a aucun symptôme sauf l'absence.
 *
 * Ce n'est pas une hypothèse : Overwatch est entré au catalogue en V402 et il
 * a manqué ici pendant quarante minutes, sans qu'aucun des deux cent mille
 * contrôles du dépôt ne le dise.
 */

const TABLE = join(process.cwd(), "desktop", "src", "jeuxProcessus.js");

/** Les jeux que l'application sait reconnaître, lus à la source. */
function detectables(): string[] {
  const texte = readFileSync(TABLE, "utf8");
  return [...texte.matchAll(/^\s*"([^"]+)":\s*\[/gm)].map((m) => m[1]);
}

describe("les jeux détectables par l'application de bureau", () => {
  it("lit vraiment la table, et elle n'est pas vide", () => {
    // Sans ce témoin, un fichier renommé ou un motif devenu aveugle rendrait
    // le contrôle suivant vert en signalant que tout manque — ce que
    // `toEqual([])` ne dit justement pas dans ce sens-là.
    expect(detectables().length).toBeGreaterThanOrEqual(JEUX.length);
  });

  it("couvre chaque jeu du catalogue", () => {
    const invisibles = JEUX.map((j) => j.nom).filter((n) => !detectables().includes(n));
    expect(invisibles).toEqual([]);
  });

  it("ne surveille pas un jeu qui n'existe plus au catalogue", () => {
    /**
     * L'autre sens. Un processus surveillé pour un jeu retiré ne casse rien —
     * il ouvre une session sur un nom que le site refusera — mais c'est du
     * code mort dans un fichier qu'on n'ouvre presque jamais.
     */
    const noms = new Set(JEUX.map((j) => j.nom));
    expect(detectables().filter((n) => !noms.has(n))).toEqual([]);
  });
});
