import { pointsSur, SEUIL_JOUR, SEUIL_SEMAINE, veiller } from "./veille";

describe("veille de volume", () => {
  it("ne dit rien tant que le volume reste ordinaire", () => {
    expect(veiller(300, 1500).alerte).toBeNull();
  });

  it("parle du jour dès le seuil franchi", () => {
    expect(veiller(SEUIL_JOUR, 0).alerte).toBe("jour");
  });

  it("parle de la semaine quand le jour va bien mais pas le cumul", () => {
    expect(veiller(200, SEUIL_SEMAINE).alerte).toBe("semaine");
  });

  it("ne parle que du jour quand les deux sont franchis", () => {
    // Annoncer les deux à la fois transformerait un constat en réquisitoire.
    expect(veiller(SEUIL_JOUR + 500, SEUIL_SEMAINE + 5000).alerte).toBe("jour");
  });

  it("ne rend pas de total négatif", () => {
    const v = veiller(-100, -3000);
    expect(v.pointsJour).toBe(0);
    expect(v.pointsSemaine).toBe(0);
    expect(v.alerte).toBeNull();
  });
});

describe("fenêtre glissante", () => {
  const T = new Date("2026-08-23T12:00:00Z");
  const ilYA = (heures: number) => new Date(T.getTime() - heures * 3600_000);

  it("compte ce qui est dans la fenêtre, et rien d'autre", () => {
    const parties = [
      { date: ilYA(1), pompesCalculees: 40 },
      { date: ilYA(20), pompesCalculees: 30 },
      { date: ilYA(30), pompesCalculees: 100 },
    ];
    expect(pointsSur(parties, 1, T)).toBe(70);
    expect(pointsSur(parties, 7, T)).toBe(170);
  });

  it("glisse, au lieu de repartir de zéro au changement de jour", () => {
    // Quelqu'un qui joue du vendredi au dimanche ne doit pas voir son total
    // effacé le lundi matin, au moment précis où il serait utile.
    const parties = [{ date: ilYA(13), pompesCalculees: 900 }];
    expect(pointsSur(parties, 1, T)).toBe(900);
  });

  it("ignore une valeur négative en base plutôt que de soustraire", () => {
    const parties = [{ date: ilYA(1), pompesCalculees: -500 }, { date: ilYA(1), pompesCalculees: 40 }];
    expect(pointsSur(parties, 1, T)).toBe(40);
  });

  it("rend zéro sans partie", () => {
    expect(pointsSur([], 7, T)).toBe(0);
  });
});
