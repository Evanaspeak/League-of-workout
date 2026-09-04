import {
  decisionProfilPublic, jetonPlausible, LONGUEUR_MIN_JETON, nouveauJetonProfil,
} from "@/lib/profilPublic";

describe("le jeton d'un profil public", () => {
  test("il est assez long pour ne pas se deviner", () => {
    expect(nouveauJetonProfil().length).toBeGreaterThanOrEqual(LONGUEUR_MIN_JETON);
  });

  test("il tient dans une adresse sans être réencodé", () => {
    // base64url : ni « + », ni « / », ni « = ». Un jeton réencodé dans un lien
    // collé à la main ne retrouve plus sa ligne en base.
    expect(nouveauJetonProfil()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("deux tirages diffèrent", () => {
    expect(nouveauJetonProfil()).not.toBe(nouveauJetonProfil());
  });

  test("une adresse trop courte ne fait pas interroger la base", () => {
    expect(jetonPlausible("a".repeat(LONGUEUR_MIN_JETON))).toBe(true);
    expect(jetonPlausible("a".repeat(LONGUEUR_MIN_JETON - 1))).toBe(false);
    expect(jetonPlausible("")).toBe(false);
    expect(jetonPlausible(null)).toBe(false);
    expect(jetonPlausible(42)).toBe(false);
  });
});

describe("le réglage du profil public", () => {
  test("l'allumer tire un jeton", () => {
    const r = decisionProfilPublic(true, null, () => "JETON");
    expect(r).toEqual({ ok: true, jetonProfil: "JETON" });
  });

  test("le rallumer alors qu'il l'est déjà GARDE le lien", () => {
    // Sinon un simple aller-retour dans les réglages casserait un lien qu'on
    // vient de coller quelque part.
    const r = decisionProfilPublic(true, "DEJA", () => "AUTRE");
    expect(r).toEqual({ ok: true, jetonProfil: "DEJA" });
  });

  test("l'éteindre efface le jeton — éteindre, c'est révoquer", () => {
    expect(decisionProfilPublic(false, "DEJA")).toEqual({ ok: true, jetonProfil: null });
  });

  test.each([
    ["chaîne", "true"], ["nombre", 1], ["nul", null],
    ["absent", undefined], ["objet", {}],
  ])("une valeur %s est REFUSÉE, jamais convertie", (_nom, valeur) => {
    // Un réglage de confidentialité qu'on convertit en silence enregistre le
    // contraire de ce qui a été demandé, et personne ne le vérifie.
    const r = decisionProfilPublic(valeur, null);
    expect(r.ok).toBe(false);
  });
});
