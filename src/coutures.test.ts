import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le balayage des coutures et des nombres bruts sait-il ÉCHOUER ?
 *
 * L'état sain du produit est zéro trouvaille : les écrans ne peuvent donc pas
 * distinguer un motif juste d'un motif aveugle. C'est l'angle mort de tous les
 * outils de ce genre, et il a mordu au premier jet — la première version de
 * `scripts/coutures.mjs` a rendu « rien à signaler » sur douze mille textes
 * avec un motif qui ne voyait PAS « 15360 / 25000 », c'est-à-dire le défaut
 * exact pour lequel il existe. Sa borne arrière contenait l'espace ordinaire.
 *
 * Les cas ci-dessous sont donc FABRIQUÉS, et les quatre premiers sont des
 * défauts RÉELS, recopiés du journal.
 */

const SRC = readFileSync(join(process.cwd(), "scripts", "coutures.mjs"), "utf8");

/** Le motif tel qu'il est écrit dans l'outil, et non une copie qui dériverait. */
function motif(nom: string): RegExp {
  const m = new RegExp(`export const ${nom} = (/.+/)[a-z]*;`).exec(SRC);
  if (!m) throw new Error(`Motif ${nom} introuvable dans scripts/coutures.mjs`);
  const litteral = m[1];
  return new RegExp(litteral.slice(1, litteral.lastIndexOf("/")), "u");
}

const COUTURE = motif("COUTURE");
const BRUT = motif("BRUT");

type Cas = { nom: string; texte: string; couture: boolean; brut: boolean };

const CAS: Cas[] = [
  // ── Les défauts réels, recopiés du journal ───────────────────────────────
  { nom: "la pastille de seuil (V468)", texte: "5分 から効きます", couture: true, brut: false },
  { nom: "la date du mur des records", texte: "太郎、9月5日 に 300 ポイント", couture: true, brut: false },
  // Le témoin du resserrement : le katakana n'est écarté que devant du
  // katakana. Un nom de jeu suivi d'un hiragana reste une couture.
  { nom: "un nom de jeu cousu (V488)", texte: "デッドバイデイライト を受け付けました。", couture: true, brut: false },
  { nom: "les paliers du rail", texte: "15360 / 25000", couture: false, brut: true },
  { nom: "le compte de parties", texte: "試合数 1116", couture: false, brut: true },
  // ── Ce que le motif doit LAISSER passer ─────────────────────────────────
  { nom: "un nombre groupé en japonais", texte: "15,360 / 25,000", couture: false, brut: false },
  { nom: "un nombre groupé en français", texte: "15 360 points d'effort", couture: false, brut: false },
  { nom: "un nombre groupé en allemand", texte: "15.360 Punkte", couture: false, brut: false },
  { nom: "une date japonaise", texte: "2026年9月7日に同意", couture: false, brut: false },
  { nom: "une date en barres obliques", texte: "Mid · 8/8/10 · 2026/9/6", couture: false, brut: false },
  { nom: "un chiffre latin séparé, qui est la convention", texte: "60 試合", couture: false, brut: false },
  { nom: "un composé japonais collé", texte: "1分55秒", couture: false, brut: false },
  // Deux katakana séparés : c'est la convention pour un composé étranger, et
  // c'est le seul faux positif que le détecteur ait jamais rendu.
  { nom: "deux mots en katakana", texte: "ソロ/デュオ ランク", couture: false, brut: false },
  { nom: "une phrase sans nombre ni couture", texte: "溜まった負債は放っておいても消えません。", couture: false, brut: false },
];

describe("le balayage des écrans sait échouer", () => {
  it("voit les quatre défauts que le journal a payés", () => {
    for (const c of CAS.filter((x) => x.couture || x.brut)) {
      expect({ [c.nom]: { couture: COUTURE.test(c.texte), brut: BRUT.test(c.texte) } })
        .toEqual({ [c.nom]: { couture: c.couture, brut: c.brut } });
    }
  });

  it("et laisse passer ce qui va bien", () => {
    /**
     * Sans cette moitié, un motif qui refuse TOUT passerait le contrôle
     * ci-dessus. Un garde qui crie sur ce qui va bien finit par ne plus se
     * lire, et c'est écrit six fois au journal.
     */
    for (const c of CAS.filter((x) => !x.couture && !x.brut)) {
      expect({ [c.nom]: { couture: COUTURE.test(c.texte), brut: BRUT.test(c.texte) } })
        .toEqual({ [c.nom]: { couture: false, brut: false } });
    }
  });

  it("porte les deux moitiés de son jeu de cas", () => {
    // Le témoin : un tableau vidé rendrait les deux contrôles verts sans rien
    // éprouver, et un tableau qui ne porterait que des cas sains ne dirait
    // rien de la détection.
    expect(CAS.filter((c) => c.couture || c.brut).length).toBeGreaterThanOrEqual(4);
    expect(CAS.filter((c) => !c.couture && !c.brut).length).toBeGreaterThanOrEqual(6);
  });
});

describe("et il dit ce qu'il n'a pas regardé", () => {
  it("compte les textes lus et refuse un balayage vide", () => {
    /**
     * « Rien trouvé » et « rien regardé » se ressemblent, et c'est la faute
     * que ce projet a déjà commise sur l'audit d'accessibilité : un rapport
     * annonçant zéro constat sur des pages jamais ouvertes est l'inverse d'un
     * audit. L'outil compte donc, et sort en erreur sous vingt textes.
     */
    // Le motif porte sur la FORME du décompte et non sur le nom de la
    // variable : celui-ci a changé quand le balayage est devenu une
    // fonction, et un garde épinglé sur un nom devient muet le jour du
    // remaniement, c'est-à-dire le jour où l'on aurait besoin de lui.
    expect(SRC).toMatch(/lus \+= \w+\.length/);
    expect(SRC).toMatch(/lus < 20/);
    expect(SRC).toMatch(/process\.exit\(1\)/);
  });

  it("ne signale pas un nombre que la langue écrit DÉJÀ sans séparateur", () => {
    /**
     * L'espagnol ne groupe pas à quatre chiffres.
     *
     * Le motif seul y rendait quatre faux positifs sur le tableau de bord —
     * « Paga 2000 puntos », « 0 / 2000 », « Objetivo: 1000 » — tous sur des
     * nombres parfaitement passés par `Intl`. Un garde qui crie sur ce qui va
     * bien finit par ne plus se lire.
     *
     * Le fait est vérifié auprès de l'AUTORITÉ, pas recopié : c'est `Intl`
     * qui décide, ici comme dans l'outil.
     */
    expect(new Intl.NumberFormat("es").format(2000)).toBe("2000");
    expect(new Intl.NumberFormat("es").format(10000)).not.toBe("10000");
    expect(new Intl.NumberFormat("fr").format(2000)).not.toBe("2000");

    // L'outil DEMANDE à Intl au lieu de porter un plancher par langue : une
    // liste vieillirait, `Intl` non.
    expect(SRC).toMatch(
      /function ecritAutrement\([\s\S]{0,500}new Intl\.NumberFormat\(langue\)[\s\S]{0,80}!==/,
    );
    // Et c'est bien ELLE qui décide, pas le motif seul — le retour à la forme
    // naïve est ce que ce contrôle existe pour attraper.
    expect(SRC).toMatch(/else if \(ecritAutrement\(t, LANGUE\)\)/);
    expect(SRC).not.toMatch(/else if \(BRUT\.test\(t\)\)/);
  });

  it("ne prend pas une ANNÉE dans une date pour un nombre brut", () => {
    /**
     * « Accord donné le 7 septembre 2026 » : trois faux positifs, en français,
     * en anglais et en allemand, sortis quand les rubriques « Ton profil » et
     * « Tes données » ont rejoint le balayage. Le motif écartait déjà 年 et les
     * séparateurs `/` et `-` — les dates avaient été prévues, la date LONGUE
     * latine ne l'était pas.
     *
     * Le silence des trois autres langues ne prouvait rien : l'espagnol écrit
     * 2026 sans séparateur, le japonais et le chinois le suivent d'une marque
     * déjà exclue.
     */
    expect(new Intl.NumberFormat("fr").format(2026)).not.toBe("2026");
    expect(new Intl.NumberFormat("es").format(2026)).toBe("2026");

    // Le discriminant est DEMANDÉ à Intl — les noms de mois de la langue — et
    // non écrit à la main : il en faudrait six listes, qui vieilliraient.
    expect(SRC).toMatch(/new Intl\.DateTimeFormat\(langue,\s*\{\s*month:/);
    // Et c'est bien lui qui décide, avant la comparaison de mise en forme.
    expect(SRC).toMatch(
      /if \(estAnneeDansUneDate\([\s\S]{0,60}return false;[\s\S]{0,120}NumberFormat\(langue\)/,
    );
    // Une année hors du champ des dates plausibles reste un nombre brut.
    expect(SRC).toMatch(/n < 1900 \|\| n > 2199/);
  });

  it("sépare les pages NON MESURÉES du total des constats", () => {
    /**
     * Le contrôle porte sur le BRANCHEMENT, pas sur la présence des mots.
     *
     * Mon premier jet cherchait « nonMesurees » et « NON MESURÉE » dans la
     * source : remplacer `nonMesurees.push` par `constats.push` laisse les
     * deux mots en place — la déclaration et l'affichage — et le sabotage
     * passait au vert. Une page injoignable se serait alors comptée comme un
     * constat, ce qui est précisément la confusion que ce contrôle existe pour
     * empêcher.
     */
    expect(SRC).toMatch(/nonMesurees\.push\(/);
    expect(SRC).toMatch(/constats\.push\(/);
  });

  it("range une page privée de ses données du côté NON MESURÉ", () => {
    /**
     * Le discriminant est le RÉSEAU, et il a été choisi contre l'évidence.
     *
     * Un plancher de textes semblait faire l'affaire ; mesuré, il ne
     * distingue rien : API coupée, les réglages rendent 137 textes contre 141
     * avec leurs données, parce que cet écran est fait de texte fixe. Ce qui
     * tranche est qu'un appel ait échoué.
     *
     * Le contrôle porte donc sur le BRANCHEMENT — l'écoute alimente `echecs`,
     * et `echecs` décide du rangement. Le nom seul survivrait à tout.
     */
    // **Les DEUX écoutes, et pas une.** Un appel qui n'aboutit pas et un appel
    // qui répond 500 sont deux pannes différentes : le premier est un réseau
    // coupé, le second une route cassée — c'est ce que le barème incomplet en
    // cache produisait deux versions plus tôt. Le premier jet n'exigeait que
    // `requestfailed`, et débrancher l'autre passait au vert.
    //
    // La fenêtre refuse de FRANCHIR l'écoute voisine, et ce n'est pas un
    // détail : bornée en nombre de caractères, elle atteignait le
    // `echecs.push` de l'autre listener, donc le sabotage passait encore. La
    // borne trop large est un piège que ce journal porte déjà.
    expect(SRC).toMatch(/page\.on\(\s*"requestfailed"(?:(?!page\.on\()[\s\S])*?echecs\.push\(/);
    expect(SRC).toMatch(/page\.on\(\s*"response"(?:(?!page\.on\()[\s\S])*?echecs\.push\(/);
    expect(SRC).toMatch(/if\s*\(echecs\.length\)[\s\S]{0,120}nonMesurees\.push\(/);
  });

  it("et le verdict lui-même dit qu'il reste des pages non regardées", () => {
    // Un lecteur s'arrête à la première ligne : « rien à signaler » imprimé
    // au-dessus d'un bloc de pages injoignables se lit comme un satisfecit.
    expect(SRC).toMatch(/nonMesurees\.length[\s\S]{0,160}n'ont pas été regardées/);
    expect(SRC).toMatch(/NON MESURÉE/);
  });

  it("refuse un chemin qui porte déjà sa langue", () => {
    /**
     * Le piège retombé deux fois : un préfixe posé deux fois mesure la 404,
     * et le contrôle d'atterrissage ne peut pas le voir.
     *
     * Le contrôle porte sur l'APPEL et non sur le nom : garder l'import en
     * retirant l'appel laisse le mot en place, et le sabotage passait au vert.
     * Un garde qui reconnaît un import reconnaît une intention, pas un
     * comportement — c'est écrit au journal pour le piège de focus, et je
     * viens de le refaire.
     */
    expect(SRC).toMatch(/refuserPrefixe\s*\(/);
  });
});

describe("ce qui ne change pas d'une langue à l'autre", () => {
  /**
   * Le seul détecteur possible du texte en dur SANS accent.
   *
   * `texteEnDurComposants.test.ts` cherche des lettres accentuées : « Perfect »,
   * « Continuer avec Google » et `aria-label="Fermer"` lui échappent par
   * construction, et c'est écrit trois fois au journal. Un texte qui ne CHANGE
   * PAS entre le français et le japonais est soit un nom propre, soit du texte
   * en dur — et il n'y a pas de troisième cas, puisqu'une traduction change
   * forcément d'écriture.
   *
   * Ce n'est pas un garde : c'est une liste à parcourir. Mesuré avant d'être
   * écrit — 51 invariants sur seize pages, tous des noms propres légitimes,
   * dans un rapport qui lit 885 textes français et 896 japonais.
   */
  const LATIN = motif("LATIN");

  it("trois lettres latines écartent les chiffres et les signes", () => {
    // Ce motif ne DISTINGUE pas un nom propre d'une phrase en dur — rien ne
    // le peut, les deux étant invariants — il écarte seulement ce qui ne
    // porte pas de mot du tout.
    expect(LATIN.test("Perfect")).toBe(true);
    expect(LATIN.test("Continuer avec Google")).toBe(true);
    expect(LATIN.test("League of Legends")).toBe(true);
    expect(LATIN.test("1 543")).toBe(false);
    expect(LATIN.test("· / —")).toBe(false);
    expect(LATIN.test("勝率")).toBe(false);
    // Deux lettres ne suffisent pas, et c'est la limite écrite dans l'outil :
    // « 20V / 40D » était de cette forme, et c'est le dictionnaire des
    // résultats qui le tient depuis.
    expect(LATIN.test("20V / 40D")).toBe(false);
  });

  it("refuse deux langues de la même écriture", () => {
    /**
     * Entre deux langues latines, l'identité ne prouve rien : « Configuration »
     * s'écrit pareil en français et en espagnol sans que personne ait rien
     * oublié. La comparaison n'a de sens qu'avec une langue à idéogrammes d'UN
     * SEUL côté.
     */
    const bloc = /const CJK = new Set\(\[([^\]]*)\]\);/.exec(SRC);
    expect(bloc).not.toBeNull();
    const langues = [...(bloc as RegExpExecArray)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
    // Le témoin : un ensemble vide rendrait la parité toujours vraie, donc la
    // comparaison toujours refusée — et le contrôle ci-dessous vert sur rien.
    expect(langues.length).toBeGreaterThanOrEqual(2);
    expect(langues).toContain("ja");
    expect(langues).toContain("zh");
    for (const latine of ["fr", "en", "es", "de"]) expect(langues).not.toContain(latine);
    // Et la parité est bien ce qui décide, avec une sortie en erreur.
    expect(SRC).toMatch(/CJK\.has\(LANGUE\) === CJK\.has\(AUTRE\)/);
  });

  it("balaie vraiment une SECONDE langue, et compte ce qu'elle a lu", () => {
    /**
     * Sans second balayage, l'intersection porterait sur un ensemble vide et
     * la liste serait vide — c'est-à-dire « rien à signaler » sur rien
     * regardé, la faute que cet outil existe pour ne pas commettre. Le second
     * balayage a donc son propre décompte et son propre refus.
     */
    expect(SRC).toMatch(/const second = AUTRE \? await balayer\(AUTRE\) : null;/);
    expect(SRC).toMatch(/invariants\(textes, second\.textes\)/);
    expect(SRC).toMatch(/second\.lus < 20/);
    // Et ce qu'il n'a pas regardé se dit, comme pour le premier.
    expect(SRC).toMatch(/second\.nonMesurees/);
  });
});
