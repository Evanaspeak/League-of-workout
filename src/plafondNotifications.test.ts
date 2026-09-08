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
    expect(push).toMatch(/deja\s*>=\s*budget/);
    expect(push).toMatch(/envoiPush\s*\n?\s*\.count\(/);
  });
});

/**
 * Le RANG, et pourquoi il a besoin de son propre garde.
 *
 * Le rang par défaut est 2, donc un appelant qui l'oublie CÈDE la place au
 * lieu de la prendre : c'est le bon défaut, et c'est aussi ce qui rend
 * l'oubli silencieux dans l'autre sens. Retirer `{ rang: 1 }` du seuil ne
 * casse rien, ne fait rougir aucun test de route, et rend la réserve
 * entièrement inerte — le seuil se remet à céder au rappel du matin, ce qui
 * est exactement le défaut qu'on vient de corriger.
 *
 * Ce garde nomme donc les deux notifications qui doivent le déclarer, et il
 * les trouve par leur TAG plutôt que par leur fichier : un fichier de route
 * peut envoyer plusieurs notifications, et c'est celle-ci qu'on veut.
 */
describe("le rang des notifications", () => {
  /** Ce qui doit passer même quand le budget est presque plein, et pourquoi. */
  const RANG_UN: Record<string, string> = {
    "wow-dette":
      "le seuil franchi arrive PENDANT qu'on joue : c'est le seul moment où la " +
      "personne peut agir, et le module écrit que c'est la raison d'être du canal",
    "wow-relance":
      "une fois par trimestre, et seul message adressé à quelqu'un qui a cessé " +
      "de venir : le perdre au profit d'un rappel du matin l'échangerait contre " +
      "sa propre répétition",
  };

  it("le seuil et la relance se déclarent rang 1", () => {
    const manquants: string[] = [];
    let examinees = 0;
    for (const [fichier, src] of lu) {
      for (const tag of Object.keys(RANG_UN)) {
        // La fenêtre s'arrête au point-virgule : l'appel suivant du même
        // fichier n'a pas à fournir le rang de celui-ci.
        const m = new RegExp(`notifier\\([^;]*?"${tag}"[^;]*?;`, "s").exec(src);
        if (!m) continue;
        examinees += 1;
        if (!/\brang:\s*1\b/.test(m[0])) manquants.push(`${fichier} · ${tag}`);
      }
    }
    // Sans témoin, un tag renommé rendrait ce contrôle vert en n'examinant
    // aucun appel — et c'est précisément le jour où le rang serait perdu.
    expect(examinees).toBe(Object.keys(RANG_UN).length);
    expect(manquants).toEqual([]);
  });

  it("chaque rang 1 porte sa raison", () => {
    for (const [tag, raison] of Object.entries(RANG_UN)) {
      expect({ tag, longueur: raison.length > 40 }).toEqual({ tag, longueur: true });
    }
  });

  /**
   * La réserve doit RESTREINDRE, sinon elle ne réserve rien. Une valeur nulle
   * rendrait les deux budgets égaux et le rang inutile ; une valeur égale au
   * plafond empêcherait tout rang 2 de jamais partir.
   */
  it("la réserve laisse de la place aux deux rangs", () => {
    // Les deux nombres se lisent dans la SOURCE et non par un import : ce
    // module tire prisma derrière lui, que jest ne sait pas charger ici.
    const src = lu.get("lib/push.ts")!;
    const nombre = (nom: string) => {
      const m = new RegExp(`${nom} = (\\d+)`).exec(src);
      expect(m).not.toBeNull();
      return Number(m![1]);
    };
    const max = nombre("NOTIFS_PAR_SEMAINE_MAX");
    const reserve = nombre("RESERVE_RANG_UN");
    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeLessThan(max);
  });

  /**
   * Et le budget doit vraiment DÉPENDRE du rang. Le mot « rang » peut rester
   * partout — dans la signature, dans les commentaires, dans une variable
   * qu'on ne lit plus — sans que le plafond en tienne compte : c'est la forme
   * de sabotage que ce projet paie en boucle.
   */
  it("le budget se déduit du rang, dans le passage obligé", () => {
    const src = lu.get("lib/push.ts")!;
    expect(src).toMatch(/rang === 1[\s\S]{0,120}RESERVE_RANG_UN/);
  });
});
