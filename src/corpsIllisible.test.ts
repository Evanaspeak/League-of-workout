import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Un corps de requête illisible ne rend pas « Erreur serveur ».
 *
 * `request.json()` LÈVE sur un corps tronqué ou vide — un octet perdu sur un
 * réseau mobile, un mandataire qui coupe, un client qui envoie du vide. Sans
 * rattrapage, la route répond 500 : elle accuse le serveur d'une panne qui
 * n'existe pas, et envoie chercher au mauvais endroit.
 *
 * Le recensement en a trouvé NEUF dans ce cas sur dix-neuf, et les deux plus
 * mal placées étaient `beta-access` et `auth/register` — les seules routes que
 * quelqu'un sans compte touche. On lui disait que le site est cassé au moment
 * précis où l'on cherche à le faire entrer. C'est le motif que ce projet paie
 * en boucle : une règle appliquée à une partie de ses lieux, et personne pour
 * dire lesquels.
 *
 * Le contrôle porte sur la FORME et non sur le résultat : toute lecture du
 * corps doit passer par `lireCorps`, ou porter son propre `.catch`. Les dix
 * qui gardent le leur ont une raison — leur refus est plus précis qu'un refus
 * générique, « Lien invalide ou expiré » pour un lien de récupération — et
 * elles ne sont pas réécrites pour ça.
 */

const API = join(process.cwd(), "src", "app", "api");

function routes(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const c = join(dossier, e.name);
    if (e.isDirectory()) routes(c, out);
    else if (/^route\.tsx?$/.test(e.name)) out.push(c);
  }
  return out;
}

/** Une lecture du corps, avec ce qui la suit immédiatement. */
const LECTURE = /\b(?:req|request)\s*\.\s*json\s*\(\s*\)\s*(\.catch\b)?/g;

describe("le corps d'une requête ne fait jamais tomber une route", () => {
  const tous = routes(API);

  it("chaque lecture du corps est rattrapée", () => {
    const fautives: string[] = [];
    let lectures = 0;

    for (const f of tous) {
      const rel = relative(API, f).split("\\").join("/");
      const texte = sansCommentaires(readFileSync(f, "utf8"));
      const parLireCorps = /\blireCorps\s*</.test(texte) || /\blireCorps\s*\(/.test(texte);
      for (const m of texte.matchAll(LECTURE)) {
        lectures += 1;
        // `lireCorps` porte le rattrapage : la route qui l'emploie n'a plus
        // aucune lecture nue à elle — le motif ne trouve alors que celle qui
        // vit dans le module partagé, et ce fichier-là n'est pas une route.
        if (!m[1] && !parLireCorps) fautives.push(`${rel} : ${m[0]}`);
      }
    }

    expect(fautives).toEqual([]);
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert en
    // n'examinant aucune route.
    expect(lectures).toBeGreaterThanOrEqual(8);
  });

  /**
   * Le module partagé est éprouvé en l'EXÉCUTANT, pas en lisant son texte.
   *
   * Ce contrôle épinglait deux motifs dans la source de `corpsRequete.ts` — le
   * `catch` et `Array.isArray`. Il éprouvait donc le MOTIF et non la RÈGLE, et
   * son motif ne couvrait que deux des trois conditions. Mesuré : la condition
   * de TYPE retirée, il restait vert, la suite entière aussi — **2854 tests** —
   * et la porte d'entrée du produit se mettait à répondre « Pseudo manquant »
   * sur un corps qui est un nombre, une chaîne ou un booléen. Elle accusait la
   * saisie de quelqu'un d'un défaut qui n'est pas le sien, c'est-à-dire
   * exactement ce que ce module existe pour empêcher.
   *
   * Ce qu'un motif ne peut pas simuler, c'est d'être APPELÉ. Le garde exige
   * donc que le module ait un test qui l'importe ET l'appelle — un import seul
   * est une intention, pas un comportement, et c'est le défaut déjà payé sur
   * le garde du nom publié comme sur celui de la porte des routes. Le
   * comportement lui-même vit dans `src/lib/corpsRequete.test.ts`, une
   * condition par cas.
   *
   * La règle est bornée à ce module-ci, avec sa raison : c'est le seul que
   * dix-neuf routes appellent pour décider ce qu'elles font d'un corps qu'on
   * leur a mal donné.
   */
  it("le module partagé a un test qui l'exécute", () => {
    const test = join(process.cwd(), "src", "lib", "corpsRequete.test.ts");
    expect(existsSync(test)).toBe(true);
    const texte = sansCommentaires(readFileSync(test, "utf8"));
    expect(texte).toMatch(/import\s*\{[^}]*\blireCorps\b[^}]*\}\s*from/);
    expect((texte.match(/\blireCorps\s*\(/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
