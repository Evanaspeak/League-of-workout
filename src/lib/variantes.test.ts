import { toVariante, varianteApplicable, VARIANTES, EXERCICE_DE_LA_VARIANTE } from "./variantes";

describe("lecture d'une variante venue du réseau", () => {
  it("accepte celles du catalogue", () => {
    for (const v of VARIANTES) expect(toVariante(v)).toBe(v);
  });

  it("refuse tout le reste", () => {
    for (const rebut of [null, undefined, 42, "", "GENOUX", "pompes", {}, ["genoux"]]) {
      expect(toVariante(rebut)).toBeNull();
    }
  });
});

describe("applicabilité", () => {
  it("garde l'annotation quand l'exercice concerné est de la partie", () => {
    expect(varianteApplicable("genoux", ["pompes", "boxe"])).toBe("genoux");
  });

  it("l'écarte quand il n'y est pas", () => {
    // Un réglage posé du temps des pompes suivrait quelqu'un passé à la
    // boxe : l'historique annoncerait des pompes qui n'ont pas eu lieu.
    expect(varianteApplicable("genoux", ["boxe"])).toBeNull();
  });

  it("ne fabrique rien à partir de rien", () => {
    expect(varianteApplicable(null, ["pompes"])).toBeNull();
  });
});

it("chaque variante nomme un exercice", () => {
  for (const v of VARIANTES) expect(EXERCICE_DE_LA_VARIANTE[v]).toBeTruthy();
});
