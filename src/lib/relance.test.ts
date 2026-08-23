import { relancer, JOURS_ABSENCE, JOURS_ENTRE_RELANCES } from "./relance";

const MAINTENANT = new Date("2026-08-23T09:00:00Z");
const ilYA = (jours: number) =>
  new Date(MAINTENANT.getTime() - jours * 24 * 3600_000);

describe("relance après absence", () => {
  it("se tait avant le seuil", () => {
    expect(relancer({ dernierePartie: ilYA(3), derniereRelance: null }, MAINTENANT)).toBe(false);
    expect(relancer(
      { dernierePartie: ilYA(JOURS_ABSENCE - 1), derniereRelance: null }, MAINTENANT,
    )).toBe(false);
  });

  it("part à partir du seuil", () => {
    expect(relancer(
      { dernierePartie: ilYA(JOURS_ABSENCE), derniereRelance: null }, MAINTENANT,
    )).toBe(true);
  });

  it("ne relance pas un compte qui n'a jamais joué", () => {
    // Il n'est pas parti, il n'est jamais arrivé. Lui dire « ça fait deux
    // semaines » n'aurait aucun sens : c'est un problème de prise en main.
    expect(relancer({ dernierePartie: null, derniereRelance: null }, MAINTENANT)).toBe(false);
  });

  it("ne redit pas la même chose le lendemain", () => {
    // Une application qui redit tous les jours « tu nous manques » se fait
    // couper, et elle l'a cherché.
    expect(relancer(
      { dernierePartie: ilYA(40), derniereRelance: ilYA(1) }, MAINTENANT,
    )).toBe(false);
  });

  it("s'autorise une seconde fois, longtemps après", () => {
    expect(relancer(
      { dernierePartie: ilYA(200), derniereRelance: ilYA(JOURS_ENTRE_RELANCES) }, MAINTENANT,
    )).toBe(true);
  });
});
