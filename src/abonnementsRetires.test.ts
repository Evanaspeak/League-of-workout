import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { sansCommentaires } from "./test/sansCommentaires";

const SRC = join(__dirname);

function fichiersSource(dossier: string, out: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith(".") || entree.name === "node_modules" || entree.name === "generated") continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) fichiersSource(chemin, out);
    else if (/\.tsx?$/.test(entree.name) && !/\.test\.tsx?$/.test(entree.name)) out.push(chemin);
  }
  return out;
}

/**
 * Un abonnement posé au montage se retire au démontage.
 *
 * `evenementsApparies.test.ts` tient les NOMS : tout événement du projet a son
 * émetteur et son auditeur. Il ne dit rien du cycle de vie — un
 * `addEventListener` posé dans un `useEffect` sans son retrait survit au
 * démontage, et le composant suivant en pose un deuxième.
 *
 * Le symptôme ne ressemble pas à sa cause, et le journal le décrit déjà pour
 * le pont Electron : « des rappels s'empilent sur des composants démontés, et
 * une partie enregistrée plusieurs fois ne se rattache à rien ». Sur
 * `wow-dette-changee`, écouté dans quinze fichiers, ça donne un aller-retour
 * vers `/api/dette` par navigation passée, indéfiniment.
 *
 * **Deux règles, et la seconde est celle qu'on ne voit pas.** Un retrait
 * ABSENT se remarque en relisant l'effet ; un retrait qui ne retire RIEN, non.
 * `removeEventListener("x", () => …)` reçoit une fonction différente de celle
 * qu'on a posée : l'appel réussit, ne retire rien, et le code a l'air complet.
 * Le rappel doit donc être une constante NOMMÉE des deux côtés.
 *
 * Deux abonnements du dépôt sont écrits en ligne, et les deux sont hors d'un
 * effet — la capture de `beforeinstallprompt` dans le script de la mise en
 * page, et le suivi du focus de `usePiegeFocus`. Ils sont PERMANENTS par
 * construction : posés une fois au chargement du module, jamais démontés. La
 * règle ne les vise pas, et c'est pourquoi elle n'a aucune dispense à porter.
 *
 * La portée s'arrête à `src/` : la coquille Electron n'a pas de `useEffect`,
 * donc pas de démontage, et ses abonnements vivent aussi longtemps que la
 * fenêtre. Leur cycle de vie est tenu par `desktop/src/overlay.test.ts`.
 */

/** L'intérieur d'un appel, suivi à la PROFONDEUR des parenthèses. */
export function corpsDesEffets(source: string): string[] {
  const out: string[] = [];
  const motif = /useEffect\s*\(/g;
  // La position rendue par `exec` suffit : la VALEUR du résultat n'est jamais
  // lue, et `noUnusedLocals` le dit avant qu'on s'en aperçoive.
  while (motif.exec(source)) {
    let i = motif.lastIndex;
    let profondeur = 1;
    const debut = i;
    while (i < source.length && profondeur > 0) {
      const c = source[i];
      // Les chaînes sont sautées : une parenthèse y est du texte, et un
      // découpage qui les compte s'arrête n'importe où.
      if (c === '"' || c === "'" || c === "`") {
        const fin = c;
        i++;
        while (i < source.length && source[i] !== fin) {
          if (source[i] === "\\") i++;
          i++;
        }
      } else if (c === "(") profondeur++;
      else if (c === ")") profondeur--;
      i++;
    }
    out.push(source.slice(debut, i - 1));
  }
  return out;
}

const ARG = String.raw`("[^"]+"|[A-Za-z_$][\w$]*)`;
const AJOUT = new RegExp(String.raw`(\w+)\.addEventListener\(\s*${ARG}\s*,\s*([^,)]{0,60})`, "g");
const RETRAIT = new RegExp(String.raw`(\w+)\.removeEventListener\(\s*${ARG}\s*,\s*([^,)]{0,60})`, "g");

const estEnLigne = (rappel: string) =>
  /^(\(|function\b|async\b)/.test(rappel.trim());

type Abonnement = { fichier: string; cible: string; evenement: string; rappel: string };

const effets = fichiersSource(SRC).flatMap((f) => {
  const source = sansCommentaires(readFileSync(f, "utf8"));
  return corpsDesEffets(source).map((corps) => ({ fichier: relative(SRC, f), corps }));
});

const abonnements: Abonnement[] = [];
const orphelins: string[] = [];
const enLigne: string[] = [];

for (const { fichier, corps } of effets) {
  const retraits = new Set<string>();
  for (const m of corps.matchAll(RETRAIT)) retraits.add(`${m[1]}|${m[2]}`);
  for (const m of corps.matchAll(AJOUT)) {
    const [, cible, evenement, rappel] = m;
    abonnements.push({ fichier, cible, evenement, rappel });
    if (!retraits.has(`${cible}|${evenement}`)) {
      orphelins.push(`${fichier} : ${cible}.addEventListener(${evenement}) sans retrait`);
    }
    if (estEnLigne(rappel)) {
      enLigne.push(`${fichier} : ${cible}.addEventListener(${evenement}, …) écrit en ligne`);
    }
  }
}

describe("les abonnements posés dans un effet se retirent", () => {
  it("chacun a son retrait dans le même effet", () => {
    expect(orphelins).toEqual([]);
  });

  it("et son rappel est une constante nommée, jamais écrite en ligne", () => {
    /**
     * Un rappel écrit en ligne ne peut pas se retirer : le retrait recevrait
     * une AUTRE fonction. L'appel réussit, ne retire rien, et le code a l'air
     * complet — c'est la moitié du sujet que le contrôle précédent ne voit pas.
     */
    expect(enLigne).toEqual([]);
  });

  it("porte le témoin de ce qu'il a réellement examiné", () => {
    /**
     * Un découpage cassé rendrait zéro effet, donc zéro abonnement, donc deux
     * listes vides qui s'accordent parfaitement. C'est la forme d'erreur que
     * ce fichier existe pour empêcher ailleurs.
     */
    expect(effets.length).toBeGreaterThanOrEqual(80);
    expect(abonnements.length).toBeGreaterThanOrEqual(10);
    expect(new Set(abonnements.map((a) => a.fichier)).size).toBeGreaterThanOrEqual(5);
  });

  it("et son découpage s'arrête bien au bout de l'effet", () => {
    /**
     * Le témoin du DÉCOUPAGE, distinct de celui du recensement : s'il rendait
     * le fichier entier au lieu de l'effet, les deux contrôles ci-dessus
     * resteraient verts — un retrait posé dans un AUTRE effet passerait pour
     * celui qu'on cherche.
     */
    const plusLong = Math.max(...effets.map((e) => e.corps.length));
    expect(plusLong).toBeLessThan(6000);
  });
});
