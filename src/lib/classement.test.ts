import {
  classer, debutFenetre, ecartAuPremier, JOURS_CLASSEMENT, longueurFenetre,
  type CompteClasse,
} from "@/lib/classement";
import { JOURS_AVANT_RETARD } from "@/lib/serie";

const compte = (id: string, pseudo: string, extra: Partial<CompteClasse> = {}): CompteClasse => ({
  id, pseudo, detteDepuis: null, dettePointsDus: 0, ...extra,
});

describe("la fenêtre", () => {
  it("compte sept jours, aujourd'hui inclus", () => {
    expect(debutFenetre("2026-09-03")).toBe("2026-08-28");
    expect(longueurFenetre(debutFenetre("2026-09-03"), "2026-09-03")).toBe(JOURS_CLASSEMENT);
  });

  it("traverse un changement de mois et une année bissextile", () => {
    expect(debutFenetre("2026-03-02")).toBe("2026-02-24");
    expect(debutFenetre("2024-03-02")).toBe("2024-02-25");
  });

  it("une fenêtre d'un jour est aujourd'hui", () => {
    expect(debutFenetre("2026-09-03", 1)).toBe("2026-09-03");
  });
});

describe("classer", () => {
  it("ordonne sur les points payés, du plus au moins", () => {
    const lignes = classer(
      [compte("a", "Alice"), compte("b", "Bob")],
      new Map([["a", 10], ["b", 90]]),
      "a",
    );
    expect(lignes.map((l) => l.pseudo)).toEqual(["Bob", "Alice"]);
    expect(lignes.map((l) => l.rang)).toEqual([1, 2]);
  });

  /**
   * L'ordre d'entrée est l'INVERSE de l'ordre attendu.
   *
   * Sans ça le tri de V8, qui est stable, rendrait le bon résultat en ne
   * comparant aucun pseudo : c'est exactement le test qui passait déjà avant
   * la règle qu'il prétend éprouver, et il a été écrit deux fois sur ce projet.
   */
  it("à égalité, range par pseudo, et pas dans l'ordre reçu", () => {
    const lignes = classer(
      [compte("z", "Zoé"), compte("m", "Milo"), compte("a", "Alice")],
      new Map(),
      "a",
    );
    expect(lignes.map((l) => l.pseudo)).toEqual(["Alice", "Milo", "Zoé"]);
  });

  it("à égalité, le rang est le même, et le suivant saute", () => {
    const lignes = classer(
      [compte("a", "Alice"), compte("b", "Bob"), compte("c", "Chloé"), compte("d", "Dan")],
      new Map([["a", 100], ["b", 50], ["c", 50], ["d", 10]]),
      "a",
    );
    expect(lignes.map((l) => [l.pseudo, l.rang])).toEqual([
      ["Alice", 1], ["Bob", 2], ["Chloé", 2], ["Dan", 4],
    ]);
  });

  it("tout le monde à zéro partage la première place", () => {
    const lignes = classer(
      [compte("a", "Alice"), compte("b", "Bob"), compte("c", "Chloé")],
      new Map(),
      "a",
    );
    expect(lignes.every((l) => l.rang === 1)).toBe(true);
  });

  it("un compte sans paiement vaut zéro, pas une absence", () => {
    const lignes = classer([compte("a", "Alice")], new Map(), "a");
    expect(lignes[0].points).toBe(0);
  });

  it("marque la ligne de celui qui regarde, et elle seule", () => {
    const lignes = classer(
      [compte("a", "Alice"), compte("b", "Bob")],
      new Map([["b", 5]]),
      "a",
    );
    expect(lignes.filter((l) => l.moi).map((l) => l.pseudo)).toEqual(["Alice"]);
  });

  it("arrondit les points et ne descend jamais sous zéro", () => {
    const lignes = classer(
      [compte("a", "Alice"), compte("b", "Bob")],
      new Map([["a", 12.6], ["b", -3]]),
      "a",
    );
    expect(lignes.map((l) => l.points)).toEqual([13, 0]);
  });
});

describe("le retard", () => {
  const T = (jours: number) => new Date(Date.now() - jours * 86_400_000);

  it("dit qu'un ami est en retard, et depuis combien de jours", () => {
    const lignes = classer(
      [compte("b", "Bob", { detteDepuis: T(JOURS_AVANT_RETARD), dettePointsDus: 40 })],
      new Map(),
      "a",
    );
    expect(lignes[0].enRetard).toBe(true);
    expect(lignes[0].joursDeRetard).toBe(JOURS_AVANT_RETARD);
  });

  it("une dette du jour n'est pas un retard", () => {
    const lignes = classer(
      [compte("b", "Bob", { detteDepuis: T(1), dettePointsDus: 40 })],
      new Map(),
      "a",
    );
    expect(lignes[0].enRetard).toBe(false);
  });

  /**
   * Le cas qui distingue « en retard » de « doit quelque chose ».
   *
   * Une dette soldée laisse parfois sa date derrière elle. Marquer en retard
   * quelqu'un qui ne doit plus rien est l'accusation la plus désagréable que
   * ce tableau puisse porter, et elle serait fausse.
   */
  it("une dette soldée n'est jamais en retard, même avec une vieille date", () => {
    const lignes = classer(
      [compte("b", "Bob", { detteDepuis: T(30), dettePointsDus: 0 })],
      new Map(),
      "a",
    );
    expect(lignes[0].enRetard).toBe(false);
  });

  it("le retard ne change pas l'ordre : on classe sur ce qui a été payé", () => {
    const lignes = classer(
      [
        compte("a", "Alice", { detteDepuis: T(10), dettePointsDus: 500 }),
        compte("b", "Bob"),
      ],
      new Map([["a", 100], ["b", 1]]),
      "a",
    );
    expect(lignes.map((l) => l.pseudo)).toEqual(["Alice", "Bob"]);
  });
});

describe("l'écart au premier", () => {
  it("dit ce qui manque pour rattraper", () => {
    const lignes = classer(
      [compte("a", "Alice"), compte("b", "Bob")],
      new Map([["a", 30], ["b", 100]]),
      "a",
    );
    expect(ecartAuPremier(lignes)).toBe(70);
  });

  it("vaut zéro pour celui qui mène", () => {
    const lignes = classer(
      [compte("a", "Alice"), compte("b", "Bob")],
      new Map([["a", 100], ["b", 30]]),
      "a",
    );
    expect(ecartAuPremier(lignes)).toBe(0);
  });

  it("ne dit rien quand on ne figure pas dans la liste", () => {
    const lignes = classer([compte("b", "Bob")], new Map([["b", 30]]), "a");
    expect(ecartAuPremier(lignes)).toBeNull();
  });
});
