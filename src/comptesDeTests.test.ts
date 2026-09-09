import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Aucun compte de tests écrit en dur AU-DESSUS du journal.
 *
 * `CLAUDE.md` annonçait « 2766 tests unitaires, 271 suites » et « 266 tests »
 * au navigateur. Les trois étaient faux le lendemain, et le commentaire qui
 * accompagnait le premier l'avouait : « ce nombre vieillit d'une nuit sur
 * l'autre, et il n'a aucun garde ». Un aveu n'est pas un garde.
 *
 * C'est exactement ce que ce fichier reproche partout ailleurs — un nombre
 * écrit une fois au-dessus de quelque chose qui bouge — et la correction est
 * celle déjà appliquée à `docs/lancement.md` (« l'en-tête n'écrit plus aucun
 * nombre, il dit de compter les titres ») et au fichier des questions (« le
 * total est retiré plutôt que corrigé : il rerouillerait à la question
 * suivante »). On ne rafraîchit pas, on retire.
 *
 * La frontière est le JOURNAL. Au-dessus, le fichier DÉCRIT ce que le projet
 * est aujourd'hui : un compte y est une affirmation au présent, donc elle
 * périme. En dessous, il RACONTE ce qui a été mesuré tel jour : « 272 passés
 * en 16 min 12 » est un relevé daté, et le figer est tout son intérêt.
 */

const CLAUDE = readFileSync(join(__dirname, "..", "CLAUDE.md"), "utf8");
const FRONTIERE = "## Journal des corrections";

/** Un nombre suivi de ce qu'on compte ici, hors des versions et des durées. */
const COMPTE =
  /\b\d{2,5}\s+(tests?|suites?|parcours|passés|assertions?|emplois|routes?)\b/gi;

/**
 * Sa limite, écrite plutôt que laissée à découvrir : il ne voit que les
 * CHIFFRES. Ce fichier écrit volontiers ses nombres en toutes lettres — « il
 * y en a soixante-quatre aujourd'hui » était faux de quatre — et les
 * reconnaître demanderait une table des numéraux français, c'est-à-dire une
 * liste qui vieillit à son tour. Ce qu'il attrape est la forme la plus
 * courante ; le reste se relit.
 */

/**
 * Les tolérances, chacune avec sa raison — et une seule aujourd'hui.
 *
 * Un chiffre de ce genre au-dessus du journal doit dire une DÉCISION qui ne
 * bouge pas avec la suite, pas un inventaire qui la suit.
 */
const TOLEREES: { motif: string; raison: string }[] = [
  {
    motif: "203 passés",
    raison:
      "le tableau des workers est un RELEVÉ comparatif daté — un worker contre " +
      "deux contre quatre, même machine, même construction — et le total y est le " +
      "témoin que les trois passes ont joué la MÊME suite. Le retirer effacerait " +
      "ce qui rend les trois lignes comparables. Un nombre qui décrit une mesure " +
      "prise tel jour est légitime ; ce qui ne l'est pas est un nombre qui décrit " +
      "l'état d'aujourd'hui, et qui périme donc à la version suivante.",
  },
];

describe("les comptes de tests ne s'écrivent pas dans la description", () => {
  const tete = CLAUDE.split(FRONTIERE)[0];

  it("le découpage trouve bien les deux moitiés", () => {
    // Sans ce témoin, une frontière renommée rendrait le contrôle vert en
    // n'examinant rien — la forme d'erreur que ce garde surveille.
    expect(CLAUDE).toContain(FRONTIERE);
    expect(tete.length).toBeGreaterThan(5_000);
    expect(CLAUDE.length - tete.length).toBeGreaterThan(50_000);
  });

  it("aucun compte de tests au-dessus du journal", () => {
    const trouves = [...tete.matchAll(COMPTE)]
      .map((m) => m[0])
      .filter((t) => !TOLEREES.some((x) => t.includes(x.motif)));
    expect(trouves).toEqual([]);
  });

  it("le journal, lui, garde ses relevés datés", () => {
    /**
     * L'autre moitié, et il faut les deux : un garde qui s'appliquerait au
     * fichier ENTIER ferait effacer les mesures du journal, c'est-à-dire
     * exactement ce qu'on veut y lire. Le contrôle prouve donc qu'il en
     * reste — et qu'on regarde bien deux zones différentes.
     */
    const journal = CLAUDE.slice(tete.length);
    expect([...journal.matchAll(COMPTE)].length).toBeGreaterThanOrEqual(5);
  });

  it("une tolérance qui ne désigne plus rien tombe", () => {
    const mortes = TOLEREES.filter((t) => !CLAUDE.includes(t.motif));
    expect(mortes.map((t) => t.motif)).toEqual([]);
  });
});
