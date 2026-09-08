import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { argumentsDe } from "@/quantiteLocalisee.test";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Le partage entre exercices au choix est BRANCHÉ partout.
 *
 * Le poids de chaque exercice (réponse 068) est un argument OPTIONNEL, et il
 * devait l'être : vingt-sept appels répartissent une dette dans ce dépôt, et
 * son absence garde le partage à parts égales — c'est ce qui a permis de les
 * reprendre un par un plutôt que tous à la fois.
 *
 * Le prix de cette souplesse est qu'un appelant qui l'oublie ne casse RIEN :
 * il retombe silencieusement sur le partage d'avant, donc il annonce un
 * nombre que la pastille d'à côté n'affiche pas. C'est le trou que ce projet
 * paie en boucle — « un module juste dont personne ne vérifie le branchement
 * ne sert à rien », écrit au journal pour `formaterAxe` — et c'est ce
 * contrôle-ci, et lui seul, qui rend l'argument obligatoire en pratique.
 *
 * Il porte sur l'APPEL et non sur l'import : un fichier qui importe
 * `parseParts` sans le passer a l'intention et pas le comportement.
 */

const SRC = join(process.cwd(), "src");

/** Le module qui PORTE ces fonctions : il les définit. */
const PORTE_LES_FONCTIONS = "lib/exercices.ts";

/** Combien d'arguments un appel doit porter pour que le partage y figure. */
const ARITE_ATTENDUE: Record<string, number> = {
  repartirPoints: 3,   // (total, exercices, parts)
  dureeAffichee: 3,    // (points, exercices, parts)
  dureeEffort: 3,      // (points, exercices, parts)
  /**
   * Les calories, où le troisième argument est le poids du CORPS en
   * kilogrammes. Le quatrième est le partage — deux sens sous un même mot
   * étant exactement ce que ce projet évite, l'un s'appelle `poids` et
   * l'autre `parts`.
   */
  caloriesDePoints: 4, // (points, exercices, poidsKg, parts)
};

function fichiersSource(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "generated") continue;
    const c = join(dossier, e.name);
    if (e.isDirectory()) fichiersSource(c, out);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(c);
  }
  return out;
}

describe("le partage entre exercices est branché", () => {
  const tous = fichiersSource(SRC);

  it("passe les poids à chaque appel qui répartit une dette", () => {
    const fautifs: string[] = [];
    let examines = 0;

    for (const f of tous) {
      const rel = relative(SRC, f).split("\\").join("/");
      if (rel === PORTE_LES_FONCTIONS) continue;
      const texte = sansCommentaires(readFileSync(f, "utf8"));
      for (const [nom, arite] of Object.entries(ARITE_ATTENDUE)) {
        for (const m of texte.matchAll(new RegExp(`\\b${nom}\\s*\\(`, "g"))) {
          const args = argumentsDe(texte, m.index + m[0].length - 1);
          examines += 1;
          if (args === null || args.length < arite) {
            fautifs.push(`${rel} : ${nom}(${(args ?? []).join(", ")})`);
          }
        }
      }
    }

    expect(fautifs).toEqual([]);
    // Sans ce témoin, un dossier renommé ou un motif devenu aveugle rendrait
    // le contrôle vert en n'examinant aucun appel.
    expect(examines).toBeGreaterThanOrEqual(20);
  });

  /**
   * Le défaut d'un poids absent est UN, donc les parts égales.
   *
   * Il vit dans le module, pas chez les appelants : posé chez eux, il aurait
   * une version en retard le jour où on le change, et c'est le motif que ce
   * projet paie le plus souvent.
   */
  it("le module porte lui-même le défaut, les bornes et la relecture", () => {
    const texte = sansCommentaires(
      readFileSync(join(SRC, PORTE_LES_FONCTIONS), "utf8"),
    );
    expect(texte).toMatch(/export const PART_DEFAUT\s*=\s*1;/);
    expect(texte).toMatch(/export function parseParts\s*\(/);
    // Et l'arithmétique ne borne PAS : la correction d'un résultat lui repasse
    // la ventilation d'origine en guise de poids, qui dépasse largement dix.
    const corps = texte.slice(texte.indexOf("export function repartirPoints"));
    const fin = corps.indexOf("\n}");
    expect(corps.slice(0, fin)).not.toMatch(/toPart\s*\(/);
  });
});
