import { getLevelParPompes, testAFaire, VALIDITE_TEST_JOURS } from "./scoring";

/**
 * Le niveau multiplie tout ce que l'application réclame — jusqu'à ×4,67. Il
 * doit donc être déduit du test de pompes de façon parfaitement prévisible.
 */

const NIVEAUX = [
  { niveau: 1, seuilGainageSec: 45, seuilPompes: 10, multiplicateur: 1.0, malusDefaite: 5 },
  { niveau: 2, seuilGainageSec: 90, seuilPompes: 20, multiplicateur: 1.67, malusDefaite: 8 },
  { niveau: 3, seuilGainageSec: 150, seuilPompes: 35, multiplicateur: 2.33, malusDefaite: 12 },
  { niveau: 4, seuilGainageSec: 240, seuilPompes: 50, multiplicateur: 3.33, malusDefaite: 15 },
  { niveau: 5, seuilGainageSec: 9999, seuilPompes: 999, multiplicateur: 4.67, malusDefaite: 20 },
];

const niv = (n: number) => getLevelParPompes(n, NIVEAUX).niveau;

describe("le niveau déduit du test de pompes", () => {
  test("les bornes tombent exactement où la configuration les place", () => {
    expect(niv(0)).toBe(1);
    expect(niv(10)).toBe(1);
    expect(niv(11)).toBe(2);
    expect(niv(20)).toBe(2);
    expect(niv(21)).toBe(3);
    expect(niv(35)).toBe(3);
    expect(niv(36)).toBe(4);
    expect(niv(50)).toBe(4);
    expect(niv(51)).toBe(5);
  });

  test("il est monotone : faire plus de pompes ne fait jamais baisser le niveau", () => {
    let precedent = 0;
    for (let n = 0; n <= 300; n++) {
      const courant = niv(n);
      expect(courant).toBeGreaterThanOrEqual(precedent);
      precedent = courant;
    }
  });

  test("un compte jamais testé reste au niveau le plus bas", () => {
    expect(niv(0)).toBe(1);
    expect(getLevelParPompes(0, NIVEAUX).multiplicateur).toBe(1);
  });

  test("une valeur aberrante ne casse rien", () => {
    expect(niv(-50)).toBe(1);
    expect(niv(100000)).toBe(5);
  });

  test("l'ordre de la configuration n'a pas d'importance", () => {
    const melange = [NIVEAUX[3], NIVEAUX[0], NIVEAUX[4], NIVEAUX[1], NIVEAUX[2]];
    for (const n of [0, 10, 11, 35, 51, 200]) {
      expect(getLevelParPompes(n, melange).niveau).toBe(niv(n));
    }
  });

  test("une configuration sans seuil de pompes retombe sur des valeurs sûres", () => {
    const sansSeuils = NIVEAUX.map(({ seuilPompes: _ignore, ...reste }) => reste);
    expect(getLevelParPompes(5, sansSeuils).niveau).toBe(1);
    expect(getLevelParPompes(60, sansSeuils).niveau).toBe(5);
  });
});

describe("la péremption du test", () => {
  const ilYA = (jours: number) => new Date(Date.now() - jours * 86_400_000);

  test("jamais testé, donc à faire", () => {
    expect(testAFaire(0, null)).toBe(true);
    expect(testAFaire(0, new Date())).toBe(true);
    expect(testAFaire(30, null)).toBe(true);
  });

  test("un test récent reste valable", () => {
    expect(testAFaire(30, new Date())).toBe(false);
    expect(testAFaire(30, ilYA(VALIDITE_TEST_JOURS - 1))).toBe(false);
  });

  test("passé la période de validité, il est à refaire", () => {
    expect(testAFaire(30, ilYA(VALIDITE_TEST_JOURS + 1))).toBe(true);
    expect(testAFaire(30, ilYA(365))).toBe(true);
  });

  test("la période de validité est celle documentée", () => {
    expect(VALIDITE_TEST_JOURS).toBe(30);
  });
});
