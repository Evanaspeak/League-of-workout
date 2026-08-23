import { echauffementConseille, SEUIL_ECHAUFFEMENT_SEC } from "./echauffement";

describe("rappel d'échauffement", () => {
  it("se tait sur une séance courte", () => {
    // Les quelques dizaines de secondes qui suivent une partie : prévenir à
    // chaque fois reviendrait à ne plus jamais être lu.
    expect(echauffementConseille(60)).toBe(false);
    expect(echauffementConseille(SEUIL_ECHAUFFEMENT_SEC - 1)).toBe(false);
  });

  it("parle à partir du seuil", () => {
    expect(echauffementConseille(SEUIL_ECHAUFFEMENT_SEC)).toBe(true);
    expect(echauffementConseille(1800)).toBe(true);
  });

  it("ne se déclenche pas sur une durée absurde", () => {
    for (const rebut of [NaN, Infinity, -Infinity]) {
      expect(echauffementConseille(rebut as number)).toBe(false);
    }
  });
});
