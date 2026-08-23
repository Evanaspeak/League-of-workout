import { calcScoreBattleRoyale, profilNeutre, ECHELLE_BR } from "./scoring";

/**
 * Scoring des battle royale. Il n'y a ni KDA ni victoire au sens habituel :
 * c'est la place finale qui fait la performance, et c'est elle qui doit
 * gouverner le coût de bout en bout.
 */

const NIVEAUX = [
  { niveau: 1, seuilGainageSec: 45, multiplicateur: 1.0, malusDefaite: 5 },
  { niveau: 2, seuilGainageSec: 90, multiplicateur: 1.67, malusDefaite: 8 },
  { niveau: 3, seuilGainageSec: 150, multiplicateur: 2.33, malusDefaite: 12 },
  { niveau: 4, seuilGainageSec: 240, multiplicateur: 3.33, malusDefaite: 15 },
  { niveau: 5, seuilGainageSec: 9999, multiplicateur: 4.67, malusDefaite: 20 },
];

const PONDERATIONS = [
  { role: "Top", poidsMort: 3.0, poidsKill: 1.2, poidsAssist: 0.8, maitriseActive: true },
  { role: "Jungle", poidsMort: 3.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: true },
  { role: "Support", poidsMort: 2.2, poidsKill: 0.6, poidsAssist: 1.6, maitriseActive: true },
];

const NEUTRE = profilNeutre(PONDERATIONS)!;

const cout = (placement: number, joueurs = 100, kills = 0, gainageSec = 60) =>
  calcScoreBattleRoyale({
    placement, joueurs, kills, gainageSec,
    roleWeights: NEUTRE, levelConfigs: NIVEAUX,
  }).pompesFinales;

// ── Invariant 3 : le coût suit le classement ───────────────────────────────

describe("le coût est monotone par rapport au classement", () => {
  test("finir plus mal ne coûte jamais moins cher", () => {
    for (const joueurs of [25, 50, 60, 100, 150]) {
      let precedent = -1;
      for (let place = 1; place <= joueurs; place++) {
        const c = cout(place, joueurs);
        expect(c).toBeGreaterThanOrEqual(precedent);
        precedent = c;
      }
    }
  });

  test("la dernière place est toujours la plus chère", () => {
    for (const joueurs of [25, 50, 100]) {
      const dernier = cout(joueurs, joueurs);
      for (let place = 1; place < joueurs; place++) {
        expect(cout(place, joueurs)).toBeLessThanOrEqual(dernier);
      }
    }
  });

  test("gagner ne coûte rien", () => {
    for (const joueurs of [25, 50, 100, 150]) {
      expect(cout(1, joueurs)).toBe(0);
    }
  });

  test("gagner ne coûte rien quel que soit le nombre d'éliminations", () => {
    // La règle « une victoire coûte moitié moins » est écrite dans le barème
    // et ne s'applique jamais : à la première place le score est déjà nul, et
    // la moitié de zéro reste zéro. Ce test le dit, pour qu'on ne croie pas
    // qu'un jour elle a servi.
    for (const kills of [0, 1, 5, 30]) {
      expect(cout(1, 60, kills)).toBe(0);
    }
  });

  test("le haut du classement est gratuit, le bas ne l'est jamais", () => {
    // Les toutes premières places arrondissent à zéro : la différence entre
    // premier et deuxième sur cent est trop fine pour valoir une pompe.
    // Ce qui compte, c'est que finir mal coûte réellement quelque chose.
    for (const joueurs of [25, 50, 100]) {
      expect(cout(joueurs, joueurs)).toBeGreaterThan(0);
      expect(cout(Math.round(joueurs / 2), joueurs)).toBeGreaterThan(0);
    }
  });
});

// ── Les éliminations réduisent la note, jamais l'inverse ───────────────────

describe("les éliminations", () => {
  test("plus d'éliminations ne coûte jamais plus cher, à place égale", () => {
    let precedent = Number.POSITIVE_INFINITY;
    for (let kills = 0; kills <= 25; kills++) {
      const c = cout(40, 100, kills);
      expect(c).toBeLessThanOrEqual(precedent);
      precedent = c;
    }
  });

  test("un carnage ne produit jamais de dette négative", () => {
    expect(cout(1, 100, 200)).toBeGreaterThanOrEqual(0);
    expect(cout(100, 100, 500)).toBeGreaterThanOrEqual(0);
  });
});

// ── Le niveau de gainage amplifie, il n'inverse rien ───────────────────────

describe("le niveau du joueur", () => {
  test("à performance égale, un niveau plus élevé coûte au moins autant", () => {
    const gainages = [30, 60, 120, 200, 400];
    let precedent = -1;
    for (const g of gainages) {
      const c = cout(50, 100, 0, g);
      expect(c).toBeGreaterThanOrEqual(precedent);
      precedent = c;
    }
  });

  test("le classement reste monotone quel que soit le niveau", () => {
    for (const g of [30, 120, 400]) {
      let precedent = -1;
      for (let place = 1; place <= 100; place++) {
        const c = cout(place, 100, 0, g);
        expect(c).toBeGreaterThanOrEqual(precedent);
        precedent = c;
      }
    }
  });
});

// ── Robustesse des entrées ─────────────────────────────────────────────────

describe("les entrées aberrantes", () => {
  test("une place au-delà du nombre de joueurs ne casse rien", () => {
    expect(cout(150, 100)).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(cout(150, 100))).toBe(true);
  });

  test("une partie à deux joueurs reste calculable", () => {
    expect(Number.isFinite(cout(1, 2))).toBe(true);
    expect(Number.isFinite(cout(2, 2))).toBe(true);
    expect(cout(1, 2)).toBeLessThanOrEqual(cout(2, 2));
  });

  test("le résultat est toujours un entier positif", () => {
    for (const place of [1, 7, 33, 99]) {
      const c = cout(place, 100, 3);
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  test("l'échelle de morts équivalentes est celle documentée", () => {
    expect(ECHELLE_BR).toBe(10);
  });
});

// ── Profil neutre ──────────────────────────────────────────────────────────

describe("le profil neutre", () => {
  test("il moyenne les pondérations de rôle plutôt que d'en privilégier un", () => {
    expect(NEUTRE.poidsMort).toBeCloseTo((3.0 + 3.0 + 2.2) / 3, 5);
    expect(NEUTRE.poidsKill).toBeCloseTo((1.2 + 1.0 + 0.6) / 3, 5);
  });

  test("sans pondération disponible, il n'y a pas de profil", () => {
    expect(profilNeutre([])).toBeNull();
  });
});
