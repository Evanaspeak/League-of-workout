import {
  EXERCICES, EXERCICE_IDS, quantite, formaterCompact, repartir, repartirPoints,
  parseRepartition, partPourExercice, pointsEnTemps, secondesParPoint,
  toExerciceId, toExerciceIds, isExerciceId, estEnTemps, exercicesEnTemps,
  type ExerciceId,
} from "./exercices";

/**
 * Le moteur de conversion décide ce qu'un humain doit physiquement faire.
 * S'il se trompe, l'application ment sans que personne puisse s'en apercevoir.
 * Ces tests couvrent les invariants nommés par la constitution du projet.
 */

// ── Invariant 1 : aucune répartition ne perd ni n'invente de point ──────────

describe("la répartition conserve exactement le total", () => {
  test("repartir() rend toujours la somme d'origine", () => {
    for (let total = 0; total <= 200; total++) {
      for (let parts = 1; parts <= 4; parts++) {
        const morceaux = repartir(total, parts);
        expect(morceaux).toHaveLength(parts);
        expect(morceaux.reduce((s, x) => s + x, 0)).toBe(total);
        expect(morceaux.every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
      }
    }
  });

  test("les parts ne diffèrent jamais de plus d'un point", () => {
    for (let total = 0; total <= 200; total++) {
      for (let parts = 1; parts <= 4; parts++) {
        const morceaux = repartir(total, parts);
        expect(Math.max(...morceaux) - Math.min(...morceaux)).toBeLessThanOrEqual(1);
      }
    }
  });

  test("repartirPoints() conserve le total sur toutes les sélections d'exercices", () => {
    const selections: ExerciceId[][] = [
      ["pompes"], ["squats"], ["boxe"],
      ["pompes", "squats"], ["pompes", "boxe"], ["squats", "boxe"],
      ["pompes", "squats", "boxe"],
    ];
    for (const sel of selections) {
      for (const total of [0, 1, 7, 38, 121, 999]) {
        const r = repartirPoints(total, sel);
        const somme = Object.values(r).reduce<number>((s, x) => s + (x ?? 0), 0);
        expect(somme).toBe(total);
        // Seuls les exercices demandés reçoivent une part.
        expect(Object.keys(r).sort()).toEqual([...sel].sort());
      }
    }
  });

  test("une sélection vide retombe sur les pompes plutôt que de perdre les points", () => {
    // Rendre {} ferait disparaître la dette en silence. Conserver le total
    // prime sur le respect littéral d'une sélection vide, qui ne devrait de
    // toute façon jamais arriver.
    expect(repartirPoints(50, [])).toEqual({ pompes: 50 });
  });
});

// ── Relecture d'une répartition stockée ────────────────────────────────────

describe("parseRepartition relit ce qui a été enregistré", () => {
  test("une répartition valide est rendue telle quelle", () => {
    const brut = JSON.stringify({ pompes: 19, boxe: 19 });
    expect(parseRepartition(brut, "pompes", 38)).toEqual({ pompes: 19, boxe: 19 });
  });

  test("sans répartition stockée, tout revient à l'exercice de la partie", () => {
    expect(parseRepartition(null, "squats", 40)).toEqual({ squats: 40 });
  });

  test("un JSON corrompu retombe sur l'exercice de la partie plutôt que de casser", () => {
    expect(parseRepartition("{ceci n'est pas du json", "boxe", 12)).toEqual({ boxe: 12 });
  });

  test("partPourExercice ne rend que la part demandée", () => {
    const r = parseRepartition(JSON.stringify({ pompes: 19, boxe: 19 }), "pompes", 38);
    expect(partPourExercice(r, "pompes")).toBe(19);
    expect(partPourExercice(r, "squats")).toBe(0);
  });
});

// ── Conversion en quantités affichées ──────────────────────────────────────

describe("la conversion points → quantité", () => {
  test("un point vaut une pompe, par définition", () => {
    expect(quantite(38, "pompes")).toBe(38);
    expect(EXERCICES.pompes.ratio).toBe(1);
  });

  test("les squats coûtent plus de répétitions que les pompes", () => {
    expect(quantite(38, "squats")).toBe(57);
    expect(quantite(100, "squats")).toBe(150);
  });

  test("la boxe se compte en temps, arrondi au pas de l'exercice", () => {
    expect(formaterCompact(38, "boxe")).toBe("4 min 25");
    expect(formaterCompact(121, "boxe")).toBe("14 min 05");
  });

  test("aucune quantité n'est négative, même sur un total négatif", () => {
    for (const id of EXERCICE_IDS) expect(quantite(-50, id)).toBe(0);
  });

  test("la conversion est monotone : plus de points ne donne jamais moins à faire", () => {
    for (const id of EXERCICE_IDS) {
      let precedent = -1;
      for (let p = 0; p <= 300; p++) {
        const q = quantite(p, id);
        expect(q).toBeGreaterThanOrEqual(precedent);
        precedent = q;
      }
    }
  });
});

// ── Exercices comptés en temps ─────────────────────────────────────────────

describe("le compteur de dette ne retient que les exercices au temps", () => {
  test("seule la boxe est comptée en temps aujourd'hui", () => {
    expect(estEnTemps("boxe")).toBe(true);
    expect(estEnTemps("pompes")).toBe(false);
    expect(estEnTemps("squats")).toBe(false);
    expect(exercicesEnTemps(["pompes", "squats", "boxe"])).toEqual(["boxe"]);
  });

  test("pointsEnTemps n'additionne que la part des exercices au temps", () => {
    expect(pointsEnTemps({ pompes: 19, boxe: 19 })).toBe(19);
    expect(pointsEnTemps({ pompes: 40 })).toBe(0);
    expect(pointsEnTemps({})).toBe(0);
  });

  test("secondesParPoint est cohérent avec la durée affichée", () => {
    // 38 points de boxe = 266 s, ce que formaterCompact arrondit à 4 min 25.
    expect(secondesParPoint("boxe")).toBe(7);
    expect(secondesParPoint("pompes")).toBe(6);
  });
});

// ── Lecture défensive des valeurs venues de la base ────────────────────────

describe("les identifiants d'exercice venus de la base", () => {
  test("une valeur inconnue retombe sur les pompes plutôt que de casser", () => {
    expect(toExerciceId("burpees")).toBe("pompes");
    expect(toExerciceId(null)).toBe("pompes");
    expect(toExerciceId(undefined)).toBe("pompes");
  });

  test("isExerciceId ne reconnaît que les exercices du catalogue", () => {
    expect(isExerciceId("boxe")).toBe(true);
    expect(isExerciceId("burpees")).toBe(false);
    expect(isExerciceId(42)).toBe(false);
  });

  test("toExerciceIds nettoie une liste et n'en rend jamais une vide", () => {
    expect(toExerciceIds(["boxe", "burpees", "squats"])).toEqual(["squats", "boxe"]);
    expect(toExerciceIds([])).toEqual(["pompes"]);
    expect(toExerciceIds("pas une liste")).toEqual(["pompes"]);
  });

  test("l'ordre du catalogue est respecté, quel que soit l'ordre d'entrée", () => {
    expect(toExerciceIds(["boxe", "pompes"])).toEqual(["pompes", "boxe"]);
  });
});
