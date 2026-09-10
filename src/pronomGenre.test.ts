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
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RACINE_I18N, fichiersLangue } from "@/test/fichiersLangue";

/**
 * La portée est `src/lib/i18n` ENTIER, sous-dossiers compris.
 *
 * Elle était bornée à `dictionaries/` jusqu'au 10 septembre, alors que quinze
 * modules porteurs de texte vivent un dossier au-dessus. Le crible manuel des
 * quinze est NÉGATIF pour CETTE règle — aucun pronom genré, ni chinois ni
 * japonais — donc ce qu'on ferme est le fichier qu'on ajoutera demain.
 */

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
 * TOUS les blocs CHINOIS d'un fichier, et eux seuls.
 *
 * Le japonais écrit 他 pour « autre » — « その他 », « 他の言語 », « 他と分けて »
 * — et il vit dans les mêmes fichiers. Aucun motif ne sépare le 他 chinois du
 * 他 japonais : ce qui les sépare est le BLOC où ils se trouvent. C'est la même
 * décision que pour les initiales de résultat, qui ne lisent que le français.
 *
 * Il n'en cherchait qu'UN, au premier `indexOf`. `metadonnees.ts` en porte
 * huit — une page par clé, puis les six langues sous chacune — donc sept
 * étaient invisibles. Et l'indentation n'est pas fixe : deux espaces dans les
 * dictionnaires, quatre là-bas.
 */
export function blocsChinois(source: string): string[] {
  const out: string[] = [];
  // La borne est la FERMETURE au même niveau d'indentation, et non le bloc de
  // langue suivant : le chinois est l'avant-dernier des six, mais rien ne
  // garantit qu'un bloc le suive — et deux motifs, l'un pour chaque cas,
  // capturaient le même bloc deux fois.
  for (const m of source.matchAll(/\n( +)zh: \{([\s\S]*?)\n\1\}/g)) out.push(m[2]);
  return out;
}

/**
 * Le chinois de la SECONDE forme, celle d'`apiErrors.ts`.
 *
 * La clé y EST le message français, et les traductions sont des propriétés à
 * valeur CHAÎNE : il n'y a aucun bloc `zh: {` à découper. Un pronom genré y
 * serait tout aussi invisible que dans un bloc — et c'est précisément la forme
 * qui a laissé « Cette activité n'a pas de résultat » six jours durant.
 */
export function chinoisParCle(source: string): string[] {
  return [...source.matchAll(/\bzh:\s*("(?:[^"\\]|\\.)*")/g)].map((m) => m[1]);
}

export function pronomsGenres(source: string): string[] {
  const blocs = blocsChinois(source);
  const chaines = blocs.length
    ? blocs.flatMap((b) => b.match(/"[^"\n]*"/g) ?? [])
    : chinoisParCle(source);
  return chaines.filter((s) => PRONOM_GENRE.test(s));
}

describe("aucune traduction ne donne de genre à quelqu'un", () => {
  const fichiers = fichiersLangue();
  const sources = fichiers.map((f) => [f, readFileSync(join(RACINE_I18N, f), "utf8")] as const);

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

  it("les deux formes sont lues, et hors du sous-dossier aussi", () => {
    /**
     * Un témoin PAR FORME, sinon deux aveuglements passent au vert.
     *
     * Le compte de fichiers ne les distingue pas : les cinquante-neuf du
     * sous-dossier suffisent à le satisfaire, donc il reste vert le jour où
     * le lecteur cesse de voir les huit blocs à quatre espaces de
     * `metadonnees.ts`, ou la forme par clé d'`apiErrors.ts`.
     */
    expect(sources.filter(([, s]) => blocsChinois(s).length >= 4).length)
      .toBeGreaterThanOrEqual(1);
    expect(sources.filter(([, s]) => !blocsChinois(s).length && chinoisParCle(s).length > 20).length)
      .toBeGreaterThanOrEqual(1);
  });

  it("le motif distingue le pronom des composés qui le contiennent", () => {
    // L'état sain est ZÉRO trouvaille : les fichiers réels ne peuvent pas
    // distinguer un motif juste d'un motif aveugle.
    const zh = (s: string) => `x = {\n  zh: {\n    a: ${s},\n  },\n  ja: {\n    a: "他の言語",\n  },\n}`;
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
    expect(pronomsGenres(zh('"对方"'))).toHaveLength(0);
    // Le découpage doit vraiment couper : sans ça les contrôles au-dessus
    // passeraient pour la mauvaise raison.
    expect(blocsChinois(zh('"对方"')).join("")).toContain("对方");
    expect(blocsChinois(zh('"对方"')).join("")).not.toContain("他の言語");
    // Et la forme par clé se lit aussi, sans qu'un bloc japonais s'y glisse.
    const parCle = '  "Erreur": {\n    en: "x", zh: "他的昵称", ja: "その他",\n  },\n';
    expect(pronomsGenres(parCle)).toHaveLength(1);
  });
});
