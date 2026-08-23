import { bilanHebdo, vautUnBilan, bilanDu, JOURS_BILAN, JOURS_ENTRE_BILANS } from "./bilanHebdo";

const MAINTENANT = new Date("2026-08-23T09:00:00Z");
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * 24 * 3600_000);

const partie = (jours: number, result = "D", points = 30) =>
  ({ createdAt: ilYA(jours), result, pompesCalculees: points });
const paiement = (jours: number, points = 20, jour = "2026-08-20") =>
  ({ createdAt: ilYA(jours), points, jour });

describe("bilan de la semaine", () => {
  it("compte les parties, les victoires et les défaites", () => {
    const b = bilanHebdo([partie(1, "V"), partie(2, "D"), partie(3, "D")], [], MAINTENANT);
    expect(b).toMatchObject({ parties: 3, victoires: 1, defaites: 2 });
  });

  it("laisse dehors ce qui est plus vieux que la fenêtre", () => {
    const b = bilanHebdo([partie(1), partie(JOURS_BILAN)], [], MAINTENANT);
    expect(b.parties).toBe(1);
  });

  it("additionne ce qui a été dû et ce qui a été payé", () => {
    const b = bilanHebdo([partie(1, "D", 40)], [paiement(1, 25), paiement(2, 15)], MAINTENANT);
    expect(b.pointsDus).toBe(40);
    expect(b.pointsPayes).toBe(40);
  });

  it("compte les jours distincts et non les paiements", () => {
    // Trois séries dans la même soirée font un jour actif, pas trois.
    const b = bilanHebdo([], [
      paiement(1, 10, "2026-08-22"), paiement(1, 10, "2026-08-22"),
      paiement(2, 10, "2026-08-21"),
    ], MAINTENANT);
    expect(b.joursActifs).toBe(2);
  });

  it("ne se laisse pas troubler par des valeurs négatives", () => {
    const b = bilanHebdo([partie(1, "D", -5)], [paiement(1, -3)], MAINTENANT);
    expect(b.pointsDus).toBe(0);
    expect(b.pointsPayes).toBe(0);
  });
});

describe("faut-il écrire ?", () => {
  it("se tait sur une semaine sans une partie", () => {
    // Un courriel qui dit zéro est celui qu'on se désabonne en l'ouvrant.
    // L'absence est déjà traitée par la relance.
    expect(vautUnBilan(bilanHebdo([], [], MAINTENANT))).toBe(false);
  });

  it("écrit dès qu'il s'est passé quelque chose", () => {
    expect(vautUnBilan(bilanHebdo([partie(1)], [], MAINTENANT))).toBe(true);
  });
});

describe("cadence", () => {
  it("écrit à qui n'a jamais rien reçu", () => {
    expect(bilanDu(null, MAINTENANT)).toBe(true);
  });

  it("ne réécrit pas le lendemain", () => {
    expect(bilanDu(ilYA(1), MAINTENANT)).toBe(false);
  });

  it("laisse une marge sous les sept jours", () => {
    // Un travail horaire qui viserait exactement sept jours sauterait une
    // semaine dès qu'une heure de décalage s'y glisse.
    expect(bilanDu(ilYA(JOURS_ENTRE_BILANS), MAINTENANT)).toBe(true);
    expect(JOURS_ENTRE_BILANS).toBeLessThan(JOURS_BILAN);
  });
});
