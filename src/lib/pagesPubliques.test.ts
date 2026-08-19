import { estPagePublique } from "./pagesPubliques";

describe("estPagePublique", () => {
  it("reconnaît la page d'accueil", () => {
    expect(estPagePublique("/")).toBe(true);
  });

  it("reconnaît les pages légales", () => {
    expect(estPagePublique("/cgu")).toBe(true);
    expect(estPagePublique("/confidentialite")).toBe(true);
  });

  it("reconnaît les sous-pages d'une page publique", () => {
    expect(estPagePublique("/recuperation/valider")).toBe(true);
  });

  it("ne reconnaît pas une page connectée", () => {
    expect(estPagePublique("/dashboard")).toBe(false);
    expect(estPagePublique("/history")).toBe(false);
    expect(estPagePublique("/settings")).toBe(false);
    expect(estPagePublique("/admin")).toBe(false);
  });

  it("compare des segments, pas des préfixes de texte", () => {
    // Sans cette borne, « /loginement » passerait pour la page de connexion.
    expect(estPagePublique("/loginement")).toBe(false);
    expect(estPagePublique("/cguide")).toBe(false);
  });

  it("supporte l'absence de chemin", () => {
    expect(estPagePublique(null)).toBe(false);
    expect(estPagePublique(undefined)).toBe(false);
  });
});
