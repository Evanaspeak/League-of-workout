import { calcScore } from "./scoring";

const DEFAULT_LEVEL_CONFIGS = [
  { niveau: 1, seuilGainageSec: 45, multiplicateur: 1.0, malusDefaite: 5 },
  { niveau: 2, seuilGainageSec: 90, multiplicateur: 1.67, malusDefaite: 8 },
  { niveau: 3, seuilGainageSec: 150, multiplicateur: 2.33, malusDefaite: 12 },
  { niveau: 4, seuilGainageSec: 240, multiplicateur: 3.33, malusDefaite: 15 },
  { niveau: 5, seuilGainageSec: 9999, multiplicateur: 4.67, malusDefaite: 20 },
];

const JUNGLE_WEIGHTS = { poidsMort: 3.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: true };

const DEFAULT_MASTERY = { surchargeMax: 0.5, partiesPourMax: 100 };

// Exemple 1 : Jungle, Lee Sin, 0 partie avant, K=2 M=5 A=4, Défaite, niveau 1 → 14 pompes
test("Lee Sin Jungle Défaite niveau 1 → 14 pompes", () => {
  const result = calcScore({
    kills: 2, deaths: 5, assists: 4,
    result: "D", gainageSec: 30, partiesAvant: 0,
    roleWeights: JUNGLE_WEIGHTS,
    levelConfigs: DEFAULT_LEVEL_CONFIGS,
    masteryConfig: DEFAULT_MASTERY,
  });
  expect(result.scoreBase).toBe(9);
  expect(result.malus).toBe(5);
  expect(result.surcharge).toBe(0);
  expect(result.pompesFinales).toBe(14);
});

// Exemple 2 : Jungle, Xin Zhao, K=2 M=11 A=5, Défaite, niveau 1 → 31 pompes
test("Xin Zhao Jungle Défaite niveau 1 → 31 pompes", () => {
  const result = calcScore({
    kills: 2, deaths: 11, assists: 5,
    result: "D", gainageSec: 30, partiesAvant: 0,
    roleWeights: JUNGLE_WEIGHTS,
    levelConfigs: DEFAULT_LEVEL_CONFIGS,
    masteryConfig: DEFAULT_MASTERY,
  });
  expect(result.scoreBase).toBe(26);
  expect(result.malus).toBe(5);
  expect(result.surcharge).toBe(0);
  expect(result.pompesFinales).toBe(31);
});

// Victoire : score/2
test("Victoire divise les pompes par 2", () => {
  const result = calcScore({
    kills: 2, deaths: 5, assists: 4,
    result: "V", gainageSec: 30, partiesAvant: 0,
    roleWeights: JUNGLE_WEIGHTS,
    levelConfigs: DEFAULT_LEVEL_CONFIGS,
    masteryConfig: DEFAULT_MASTERY,
  });
  expect(result.scoreBase).toBe(9);
  expect(result.malus).toBe(0);
  expect(result.pompesFinales).toBe(Math.round(9 / 2));
});

// Surcharge maîtrise à 50 parties sur 100 → 25%
test("Surcharge 50% de 50/100 → +25%", () => {
  const result = calcScore({
    kills: 0, deaths: 10, assists: 0,
    result: "D", gainageSec: 30, partiesAvant: 50,
    roleWeights: JUNGLE_WEIGHTS,
    levelConfigs: DEFAULT_LEVEL_CONFIGS,
    masteryConfig: DEFAULT_MASTERY,
  });
  expect(result.surcharge).toBeCloseTo(0.25);
  const expected = Math.round((30 + 5) * 1.25);
  expect(result.pompesFinales).toBe(expected);
});

// Surcharge désactivée pour ARAM
test("Surcharge désactivée pour ARAM", () => {
  const aramWeights = { poidsMort: 1.8, poidsKill: 0.8, poidsAssist: 1.0, maitriseActive: false };
  const result = calcScore({
    kills: 0, deaths: 5, assists: 0,
    result: "D", gainageSec: 30, partiesAvant: 100,
    roleWeights: aramWeights,
    levelConfigs: DEFAULT_LEVEL_CONFIGS,
    masteryConfig: DEFAULT_MASTERY,
  });
  expect(result.surcharge).toBe(0);
});

// Score négatif → 0 (MAX avec 0)
test("Score ne peut pas être négatif", () => {
  const result = calcScore({
    kills: 20, deaths: 0, assists: 30,
    result: "V", gainageSec: 30, partiesAvant: 0,
    roleWeights: JUNGLE_WEIGHTS,
    levelConfigs: DEFAULT_LEVEL_CONFIGS,
    masteryConfig: DEFAULT_MASTERY,
  });
  expect(result.scoreBase).toBe(0);
  expect(result.pompesFinales).toBe(0);
});
