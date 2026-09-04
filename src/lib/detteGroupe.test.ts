import { composerDetteEquipe, decisionRelais } from "@/lib/detteGroupe";

const membre = (id: string, pseudo: string, dus: number, fantome = false) => ({
  id, pseudo, dettePointsDus: dus, fantome,
});

describe("ce que l'équipe doit", () => {
  test("le total est la somme des dettes", () => {
    const d = composerDetteEquipe(
      [membre("a", "Ana", 30), membre("b", "Bob", 12), membre("c", "Cid", 0)],
      "a",
    );
    expect(d.total).toBe(42);
    expect(d.masques).toBe(0);
  });

  test("la dette la plus lourde est en tête — c'est elle qu'on vient sauver", () => {
    const d = composerDetteEquipe(
      [membre("a", "Ana", 5), membre("b", "Bob", 90), membre("c", "Cid", 40)],
      "a",
    );
    expect(d.lignes.map((l) => l.pseudo)).toEqual(["Bob", "Cid", "Ana"]);
  });

  test("à dette égale, l'ordre est celui des pseudos et non celui de la base", () => {
    // L'ordre d'entrée est l'INVERSE de l'ordre attendu : sans comparaison de
    // pseudo, le tri stable de V8 rendrait la liste telle quelle et le test
    // passerait sans rien éprouver.
    const d = composerDetteEquipe(
      [membre("c", "Zoe", 10), membre("b", "Mia", 10), membre("a", "Ana", 10)],
      "a",
    );
    expect(d.lignes.map((l) => l.pseudo)).toEqual(["Ana", "Mia", "Zoe"]);
  });

  test("un membre en mode fantôme n'a ni ligne ni part dans le total", () => {
    const d = composerDetteEquipe(
      [membre("a", "Ana", 30), membre("b", "Bob", 100, true)],
      "a",
    );
    expect(d.lignes.map((l) => l.pseudo)).toEqual(["Ana"]);
    expect(d.total).toBe(30);
  });

  test("et le total DIT ce qu'il ne compte pas", () => {
    // Sans ce compte, l'écran annoncerait la dette de l'équipe alors qu'il
    // n'en montre qu'une partie, et rien ne le signalerait.
    const d = composerDetteEquipe(
      [membre("a", "Ana", 30), membre("b", "Bob", 100, true), membre("c", "Cid", 7, true)],
      "a",
    );
    expect(d.masques).toBe(2);
  });

  test("on se voit soi-même, même en mode fantôme", () => {
    const d = composerDetteEquipe(
      [membre("a", "Ana", 30, true), membre("b", "Bob", 12)],
      "a",
    );
    expect(d.lignes.find((l) => l.moi)?.pseudo).toBe("Ana");
    expect(d.total).toBe(42);
    expect(d.masques).toBe(0);
  });

  test("une dette négative s'affiche à zéro", () => {
    const d = composerDetteEquipe([membre("a", "Ana", -5)], "a");
    expect(d.lignes[0].dus).toBe(0);
    expect(d.total).toBe(0);
  });
});

describe("ce qu'un relais peut valoir", () => {
  const bob = { id: "b", dettePointsDus: 50 };

  test("il vaut ce qu'on demande quand l'autre doit plus", () => {
    expect(decisionRelais(20, bob, "a")).toEqual({ ok: true, points: 20 });
  });

  test("il est ramené à ce que l'autre doit, jamais au-delà", () => {
    // Au-delà, l'effort ne solde rien : la dette est bornée à zéro partout
    // ailleurs, donc le surplus serait purement perdu.
    expect(decisionRelais(999, bob, "a")).toEqual({ ok: true, points: 50 });
  });

  test("on ne se relaie pas soi-même", () => {
    const r = decisionRelais(10, { id: "a", dettePointsDus: 50 }, "a");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.statut).toBe(400);
  });

  test("un membre qui ne doit plus rien n'a rien à recevoir", () => {
    const r = decisionRelais(10, { id: "b", dettePointsDus: 0 }, "a");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.statut).toBe(409);
  });

  test("un membre absent rend 404, pas 403", () => {
    // Distinguer « pas de votre équipe » de « n'existe pas » apprendrait, un
    // identifiant après l'autre, quels comptes existent.
    const r = decisionRelais(10, null, "a");
    expect(r.ok === false && r.statut).toBe(404);
  });

  test.each([
    ["zéro", 0],
    ["négatif", -5],
    ["décimal", 2.5],
    ["chaîne", "20"],
    ["absent", undefined],
    ["infini", Number.POSITIVE_INFINITY],
    ["pas un nombre", Number.NaN],
  ])("un nombre de points %s est refusé", (_nom, valeur) => {
    const r = decisionRelais(valeur, bob, "a");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.statut).toBe(400);
  });
});
