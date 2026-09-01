import { textes } from "./textes";
import { cgu } from "./dictionaries/cgu";

/**
 * Ce que `useT` fait au navigateur, `textes` le fait au serveur.
 *
 * Il existe parce qu'une page rendue au serveur ne peut pas appeler un hook :
 * c'est exactement ce qui avait laissé les deux pages du calculateur afficher
 * leur titre en français dans les six langues, alors que les traductions
 * existaient depuis le premier jour.
 *
 * La règle qu'il porte tient en une ligne — ce qui n'est pas traduit retombe
 * sur l'ANGLAIS — et c'est la ligne qui compte : le repli français est le
 * réflexe de celui qui écrit l'application, et il ne le voit jamais.
 */
describe("les textes rendus au serveur", () => {
  it("rendent la langue demandée", () => {
    expect(textes(cgu, "de")).toBe(cgu.de);
    expect(textes(cgu, "ja")).toBe(cgu.ja);
  });

  it("retombent sur l'anglais, jamais sur le français", () => {
    // Sans annotation, `as const` fige « salut » comme TYPE de `a`, et la
    // signature exige alors que l'anglais dise « salut » lui aussi.
    const partiel: { fr: Record<string, string>; en: Record<string, string> } =
      { fr: { a: "salut" }, en: { a: "hello" } };
    expect(textes(partiel, "de")).toEqual({ a: "hello" });
    expect(textes(partiel, "zh")).toEqual({ a: "hello" });
  });

  it("ne rendent jamais du vide", () => {
    // Le défaut qu'on veut empêcher n'est pas « mauvaise langue », c'est
    // « undefined » écrit en travers de l'écran.
    for (const l of ["fr", "en", "es", "de", "zh", "ja"] as const) {
      const t = textes(cgu, l);
      expect(t).toBeDefined();
      expect(Object.keys(t).length).toBeGreaterThan(0);
    }
  });
});
