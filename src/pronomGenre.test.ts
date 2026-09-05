/**
 * Le produit ne donne de genre à personne, et les traductions non plus.
 *
 * Trouvé en lisant l'écran des amis en chinois. Le libellé du champ disait
 * « 他的昵称 » — « SON pseudo », au masculin — là où le français écrit « Son
 * pseudo » (qui s'accorde avec « pseudo », pas avec la personne), l'anglais
 * « Their », l'espagnol « Su », et le japonais « 相手の » (« de l'autre »).
 * Deux langues sur six donnaient un genre à quelqu'un dont on ne sait rien.
 *
 * **Le chinois se contredisait lui-même** : le fichier écrit déjà « 对方 »
 * — « l'autre partie », neutre — deux clés plus loin, pour le même référent.
 * Ce n'est donc pas un choix de langue, c'est une traduction en retard sur les
 * autres.
 *
 * Ce garde ne tient que la moitié CHECKABLE du sujet, et le dit : le chinois
 * a un pronom genré isolable (他 / 她), là où l'allemand décline son possessif
 * sur le genre GRAMMATICAL du nom — « der Code … ihn », « das Konto … seine
 * Daten » — et où aucun motif ne distingue la chose de la personne. Les deux
 * libellés allemands ont été repris à la main, avec leur raison au journal.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DICOS = join(__dirname, "lib", "i18n", "dictionaries");

/**
 * Un pronom personnel chinois de la troisième personne, SEUL.
 *
 * 他 entre dans des composés parfaitement neutres qu'il ne faut pas confondre
 * avec lui : 其他 (« autre »), 他人 (« autrui »), 他们 (« ils »), et le 他 du
 * japonais 他の (« autre »), qui vit dans les mêmes fichiers. Le motif exige
 * donc que le caractère ne soit précédé ni suivi de ce qui en ferait un
 * composé.
 */
export const PRONOM_GENRE = /(?<![其])[他她](?![人们])/;

/**
 * Le bloc CHINOIS d'un dictionnaire, et lui seul.
 *
 * Le japonais écrit 他 pour « autre » — « その他 », « 他の言語 », « 他と分けて »
 * — et il vit dans les mêmes fichiers. Aucun motif ne sépare le 他 chinois du
 * 他 japonais : ce qui les sépare est le BLOC où ils se trouvent. C'est la même
 * décision que pour les initiales de résultat, qui ne lisent que le français.
 */
export function blocChinois(source: string): string {
  const debut = source.indexOf("zh: {");
  if (debut === -1) return "";
  const suite = source.indexOf("ja: {", debut);
  return source.slice(debut, suite === -1 ? source.length : suite);
}

export function pronomsGenres(source: string): string[] {
  return (blocChinois(source).match(/"[^"\n]*"/g) ?? []).filter((s) => PRONOM_GENRE.test(s));
}

describe("aucune traduction ne donne de genre à quelqu'un", () => {
  const fichiers = readdirSync(DICOS).filter((f) => f.endsWith(".ts") && !f.includes(".test."));
  const sources = fichiers.map((f) => [f, readFileSync(join(DICOS, f), "utf8")] as const);

  it("le chinois n'emploie pas de pronom de la troisième personne", () => {
    const fautifs = sources.flatMap(([f, s]) => pronomsGenres(s).map((x) => `${f} : ${x}`));
    expect(fautifs).toEqual([]);
  });

  it("le recensement a réellement lu quelque chose", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert.
    expect(sources.length).toBeGreaterThan(20);
    // Et il doit rester du chinois à lire : sinon le motif ne peut rien
    // trouver, et son silence ne voudrait rien dire.
    const chinois = sources.filter(([, s]) => /[一-鿿]/.test(s));
    expect(chinois.length).toBeGreaterThan(15);
  });

  it("le motif distingue le pronom des composés qui le contiennent", () => {
    // L'état sain est ZÉRO trouvaille : les fichiers réels ne peuvent pas
    // distinguer un motif juste d'un motif aveugle.
    const zh = (s: string) => `x = { zh: { a: ${s} }, ja: { a: "他の言語" } }`;
    for (const cas of ['"他的昵称"', '"抵消他的欠账"', '"她已经付清"'])
      expect(pronomsGenres(zh(cas))).toHaveLength(1);
    for (const cas of [
      '"其他"',        // « autre »
      '"向他人显示"',   // « autrui »
      '"他们"',        // « ils »
      '"对方的昵称"',   // le mot neutre qu'on veut à la place
      '"rien à voir"',
    ]) expect(pronomsGenres(zh(cas))).toHaveLength(0);
    // Et le 他 JAPONAIS, qui veut dire « autre », ne compte pas : c'est le
    // faux positif que le découpage par bloc existe pour écarter, et il
    // apparaît vraiment dans deux dictionnaires du dépôt.
    expect(pronomsGenres('x = { zh: { a: "对方" }, ja: { a: "その他" } }')).toHaveLength(0);
    // Le découpage doit vraiment couper : sans ça les deux contrôles
    // au-dessus passeraient pour la mauvaise raison.
    expect(blocChinois('x = { zh: { a: 1 }, ja: { a: 2 } }')).toContain("a: 1");
    expect(blocChinois('x = { zh: { a: 1 }, ja: { a: 2 } }')).not.toContain("a: 2");
  });
});
