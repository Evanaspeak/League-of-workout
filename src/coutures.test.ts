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
    expect(SRC).toMatch(/lus \+= textes\.length/);
    expect(SRC).toMatch(/lus < 20/);
    expect(SRC).toMatch(/process\.exit\(1\)/);
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
