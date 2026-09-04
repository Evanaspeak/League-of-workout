import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { resultat } from "@/lib/i18n/dictionaries/resultat";

/**
 * Les initiales de victoire et de défaite vivent à UN seul endroit.
 *
 * Elles étaient écrites « V » et « D » en dur à deux endroits : sous le taux
 * de victoire du tableau de bord, et dans le courriel hebdomadaire. Donc en
 * français dans les six langues, et l'espagnol tombait juste par hasard — la
 * façon la plus discrète pour un défaut de survivre à une relecture.
 *
 * La correction du courriel a été faite EN PREMIER, et elle n'en réparait
 * qu'une moitié : je n'avais pas cherché l'autre lieu de la même règle. C'est
 * le motif que ce projet paie en boucle, commis une heure après en avoir écrit
 * l'entrée de journal. Le partage est donc tenu par ce test plutôt que par la
 * mémoire.
 *
 * Ce que le garde des textes en dur ne pouvait pas voir : « V » et « D » ne
 * portent AUCUN accent, et c'est son angle mort par construction. Un mot sans
 * accent est indistinguable d'un identifiant.
 */

const SRC = join(process.cwd(), "src");
/**
 * TOUT `src/lib/i18n`, et pas seulement `dictionaries/`.
 *
 * Le premier jet ne lisait que le dossier des dictionnaires — et le doublon
 * que ce test existe pour empêcher vivait dans `courriels.ts`, un cran
 * au-dessus. Sabotage fait : les initiales remises dans le courriel, tout
 * restait vert. Un garde qui ne regarde pas l'endroit du défaut qu'il raconte
 * ne garde rien.
 */
const I18N = join(SRC, "lib", "i18n");
const PORTE_LA_REGLE = "resultat.ts";

/** Les clés qui désignent un résultat de partie, dans les deux nommages. */
const CLES = ["victoire", "defaite", "victory", "defeat"];

/**
 * Une INITIALE, pas un libellé — et la question ne se pose QU'EN FRANÇAIS.
 *
 * « Victoire » et « Defeat » sont des mots, et plusieurs dictionnaires les
 * portent à bon droit : un bouton de formulaire, une étiquette d'historique.
 * Ce qui ne doit exister qu'une fois, c'est l'abréviation.
 *
 * La longueur les sépare en français — « V » contre « Victoire » — et ELLE NE
 * LES SÉPARE PAS EN CHINOIS NI EN JAPONAIS, où le mot entier fait deux
 * caractères : « 勝利 » et « 失败 » sont des libellés, « 勝 » est une initiale,
 * et rien dans leur taille ne le dit. Le premier jet du contrôle a donc rendu
 * quatorze faux positifs — trouvé par le test, pas par la relecture.
 *
 * Le recensement ne lit donc que le bloc FRANÇAIS, celui qui fait foi partout
 * ailleurs dans ce projet. Une initiale posée dans une autre langue sans
 * l'être en français serait une clé absente du bloc de référence, et
 * `dictionaries.test.ts` la refuse déjà.
 */
export function estUneInitiale(valeur: string): boolean {
  return [...valeur.trim()].length > 0 && [...valeur.trim()].length <= 2;
}

/** Le bloc français d'un dictionnaire, seul examiné. */
export function blocFrancais(source: string): string {
  const debut = source.indexOf("fr: {");
  if (debut === -1) return "";
  const suite = source.indexOf("en: {", debut);
  return source.slice(debut, suite === -1 ? source.length : suite);
}

describe("les initiales de résultat", () => {
  const fichiers = (function lister(d: string, out: string[] = []): string[] {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const c = join(d, e.name);
      if (e.isDirectory()) lister(c, out);
      else if (e.name.endsWith(".ts") && !e.name.includes(".test.")) out.push(c);
    }
    return out;
  })(I18N);

  it("existent dans les six langues, distinctes et courtes", () => {
    // Témoin : sans lui, un dictionnaire vidé rendrait le contrôle suivant
    // vert en n'ayant plus rien à comparer.
    const langues = Object.keys(resultat);
    expect(langues.length).toBe(6);
    for (const l of langues) {
      const { victoire, defaite } = resultat[l as keyof typeof resultat];
      expect({ l, ok: estUneInitiale(victoire) && estUneInitiale(defaite) })
        .toEqual({ l, ok: true });
      expect(victoire).not.toBe(defaite);
    }
  });

  it("distingue une initiale d'un libellé", () => {
    // Le discriminant s'éprouve sur des cas fabriqués : les dictionnaires
    // réels ne contiennent que des cas qu'il accepte, donc ils ne le
    // distinguent pas d'un discriminant cassé.
    expect(estUneInitiale("V")).toBe(true);
    expect(estUneInitiale("勝")).toBe(true);
    expect(estUneInitiale("Victoire")).toBe(false);
    expect(estUneInitiale("Niederlage")).toBe(false);
    expect(estUneInitiale("")).toBe(false);
    // Le cas qui a fait tomber le premier jet, et qu'aucun de mes cas
    // fabriqués ne couvrait : en chinois et en japonais, le LIBELLÉ fait deux
    // caractères. La longueur ne tranche donc pas — d'où la lecture bornée au
    // bloc français.
    expect(estUneInitiale("勝利")).toBe(true);
    expect(blocFrancais('x = { fr: { a: 1 }, en: { a: 2 } }')).toContain("a: 1");
    expect(blocFrancais('x = { fr: { a: 1 }, en: { a: 2 } }')).not.toContain("a: 2");
  });

  it("ne sont déclarées nulle part ailleurs", () => {
    const fautifs: string[] = [];
    let examinees = 0;
    for (const f of fichiers) {
      if (f.endsWith(PORTE_LA_REGLE)) continue;
      const texte = blocFrancais(readFileSync(f, "utf8"));
      for (const cle of CLES) {
        for (const m of texte.matchAll(new RegExp(`\\b${cle}:\\s*"([^"]*)"`, "g"))) {
          examinees += 1;
          if (estUneInitiale(m[1])) fautifs.push(`${relative(SRC, f)} → ${cle}: "${m[1]}"`);
        }
      }
    }
    // Et il doit y avoir quelque chose à trier : plusieurs dictionnaires
    // portent ces clés en toutes lettres, à bon droit.
    expect(examinees).toBeGreaterThan(3);
    expect(fautifs).toEqual([]);
  });

  it("sont lues par leurs deux consommateurs", () => {
    // Par l'APPEL, jamais par l'import : un fichier qui importe sans employer
    // a l'intention et pas le comportement.
    const ecran = readFileSync(join(SRC, "app", "[locale]", "dashboard", "TableauDeBord.tsx"), "utf8");
    expect(ecran).toMatch(/useT\(\s*resultat\s*\)/);
    const courriel = readFileSync(join(SRC, "lib", "i18n", "courriels.ts"), "utf8");
    expect(courriel).toMatch(/resultat\[/);
  });
});
