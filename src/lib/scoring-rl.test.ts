import { calcScoreRocketLeague, profilNeutre, ECHELLE_RL, RL_POIDS } from "./scoring";

/**
 * Rocket League : aucune statistique ne pénalise. Seule la défaite ouvre une
 * dette, et ce qu'on a produit — buts, arrêts, passes — la rachète.
 */

const NIVEAUX = [
  { niveau: 1, seuilGainageSec: 45, multiplicateur: 1.0, malusDefaite: 5 },
  { niveau: 2, seuilGainageSec: 90, multiplicateur: 1.67, malusDefaite: 8 },
  { niveau: 3, seuilGainageSec: 150, multiplicateur: 2.33, malusDefaite: 12 },
  { niveau: 4, seuilGainageSec: 240, multiplicateur: 3.33, malusDefaite: 15 },
  { niveau: 5, seuilGainageSec: 9999, multiplicateur: 4.67, malusDefaite: 20 },
];

// profilNeutre ne moyenne que les poids : le nom du rôle ne lui sert à rien.
const NEUTRE = profilNeutre([
  { poidsMort: 3.0, poidsKill: 1.2, poidsAssist: 0.8, maitriseActive: true },
  { poidsMort: 3.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: true },
  { poidsMort: 2.2, poidsKill: 0.6, poidsAssist: 1.6, maitriseActive: true },
])!;

const cout = (
  result: "V" | "D",
  buts = 0, arrets = 0, passes = 0, gainageSec = 60,
) => calcScoreRocketLeague({
  buts, arrets, passes, result, gainageSec,
  roleWeights: NEUTRE, levelConfigs: NIVEAUX,
}).pompesFinales;

describe("une victoire ne coûte jamais rien", () => {
  test("quelle que soit la performance", () => {
    for (const [b, a, p] of [[0, 0, 0], [3, 2, 1], [0, 9, 0], [12, 0, 7]]) {
      expect(cout("V", b, a, p)).toBe(0);
    }
  });

  test("à tous les niveaux", () => {
    for (const g of [30, 60, 120, 200, 400]) expect(cout("V", 0, 0, 0, g)).toBe(0);
  });
});

describe("une défaite ouvre une dette que la performance rachète", () => {
  test("une défaite sans rien produire coûte le plein tarif", () => {
    expect(cout("D")).toBeGreaterThan(0);
  });

  test("chacune des trois statistiques réduit la dette", () => {
    const plein = cout("D");
    expect(cout("D", 1, 0, 0)).toBeLessThan(plein);
    expect(cout("D", 0, 1, 0)).toBeLessThan(plein);
    expect(cout("D", 0, 0, 1)).toBeLessThan(plein);
  });

  test("un but pèse plus qu'un arrêt, qui pèse plus qu'une passe", () => {
    expect(RL_POIDS.but).toBeGreaterThan(RL_POIDS.arret);
    expect(RL_POIDS.arret).toBeGreaterThan(RL_POIDS.passe);
    // Le poids d'assist du profil neutre est plus élevé que celui de kill, donc
    // on compare à statistiques comparables : buts contre arrêts.
    expect(cout("D", 1, 0, 0)).toBeLessThanOrEqual(cout("D", 0, 1, 0));
  });

  test("plus de production ne coûte jamais plus cher", () => {
    let precedent = Number.POSITIVE_INFINITY;
    for (let n = 0; n <= 15; n++) {
      const c = cout("D", n, n, n);
      expect(c).toBeLessThanOrEqual(precedent);
      precedent = c;
    }
  });

  test("une grosse partie perdue peut ramener la dette à zéro, jamais en dessous", () => {
    expect(cout("D", 50, 50, 50)).toBe(0);
    expect(cout("D", 999, 999, 999)).toBe(0);
  });
});

describe("le niveau amplifie sans jamais inverser", () => {
  test("à performance égale, un niveau plus élevé coûte au moins autant", () => {
    let precedent = -1;
    for (const g of [30, 60, 120, 200, 400]) {
      const c = cout("D", 1, 1, 1, g);
      expect(c).toBeGreaterThanOrEqual(precedent);
      precedent = c;
    }
  });
});

describe("les entrées aberrantes", () => {
  test("des valeurs négatives sont traitées comme zéro", () => {
    expect(cout("D", -5, -5, -5)).toBe(cout("D", 0, 0, 0));
  });

  test("le résultat est toujours un entier positif", () => {
    for (const [b, a, p] of [[0, 0, 0], [2, 3, 4], [1, 0, 9]]) {
      const c = cout("D", b, a, p);
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  test("l'échelle est celle documentée", () => {
    expect(ECHELLE_RL).toBe(5);
  });
});
