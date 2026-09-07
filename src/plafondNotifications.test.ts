import fs from "fs";
import path from "path";
import { sansCommentaires } from "./test/sansCommentaires";

/**
 * Trois notifications par semaine au maximum — réponse 103.
 *
 * Le plafond vit dans `notifier`, donc au SEUL passage obligé de tout ce que
 * le produit envoie. Ce qui peut le défaire n'est pas une ligne oubliée, c'est
 * une DISPENSE : `{ plafonne: false }` posé « juste pour celle-ci », qui ne
 * casse rien et ne se voit nulle part.
 *
 * Ce garde regarde donc le dossier plutôt que les appels connus : celui qu'on
 * ajoutera demain y passera aussi. Une seule dispense aujourd'hui, et une
 * deuxième devrait faire se demander si le plafond garde encore quelque chose.
 */

const SRC = __dirname;

/** Les fichiers autorisés à passer outre, avec leur raison. */
const DISPENSES: Record<string, string> = {
  "app/api/push/route.ts":
    "La notification d'ESSAI des réglages : la personne vient d'appuyer sur le " +
    "bouton. Un bouton qui ne fait rien sans dire pourquoi est pire que la " +
    "notification qu'il envoie, et son propre limiteur par compte la garde " +
    "déjà contre le harcèlement de soi-même.",
};

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "generated" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiers(p));
    else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) out.push(p);
  }
  return out;
}

/**
 * Le source est lu PRIVÉ de ses commentaires.
 *
 * Sans ça le garde tombe sur sa propre explication : `push.ts` et la route
 * d'essai citent tous les deux `plafonne: false` pour dire pourquoi il existe.
 * C'est le piège déjà payé deux fois ici, dans les deux sens — un commentaire
 * qui déclenche un garde, un commentaire qui le calme.
 */
const lu = new Map<string, string>();
for (const f of fichiers(SRC)) lu.set(path.relative(SRC, f), sansCommentaires(fs.readFileSync(f, "utf8")));

const appelants = [...lu].filter(([, src]) => /\bnotifier\s*\(/.test(src) && /from\s+"@?[./\w-]*push"/.test(src));

describe("le plafond de trois notifications par semaine", () => {
  it("le recensement trouve les appelants de notifier", () => {
    // Sans ce témoin, une fonction renommée ou un dossier déplacé rendrait le
    // contrôle vert en n'examinant aucun appel.
    expect(appelants.length).toBeGreaterThanOrEqual(3);
  });

  it("seule une dispense déclarée peut passer outre", () => {
    const fautifs = appelants
      .filter(([f, src]) => /plafonne\s*:\s*false/.test(src) && !(f in DISPENSES))
      .map(([f]) => f);
    expect(fautifs).toEqual([]);
  });

  it("une dispense qui ne désigne plus rien tombe", () => {
    const mortes = Object.keys(DISPENSES).filter(
      (f) => !lu.has(f) || !/plafonne\s*:\s*false/.test(lu.get(f)!),
    );
    expect(mortes).toEqual([]);
  });

  it("chaque dispense porte sa raison", () => {
    for (const [f, raison] of Object.entries(DISPENSES)) {
      expect({ f, longue: raison.length > 60 }).toEqual({ f, longue: true });
    }
  });

  it("le plafond est bien posé dans le passage obligé", () => {
    // Un module juste dont personne ne vérifie le branchement ne sert à rien :
    // la constante peut exister sans que rien ne la lise.
    const push = lu.get(path.join("lib", "push.ts"))!;
    expect(push).toMatch(/NOTIFS_PAR_SEMAINE_MAX\s*=\s*3/);
    expect(push).toMatch(/deja\s*>=\s*NOTIFS_PAR_SEMAINE_MAX/);
    expect(push).toMatch(/envoiPush\s*\n?\s*\.count\(/);
  });
});
