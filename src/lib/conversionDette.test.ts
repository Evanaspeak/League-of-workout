import { convertirDette, conversionsPossibles } from "@/lib/conversionDette";
import { EXERCICES, quantite, type ExerciceId } from "@/lib/exercices";

describe("convertir sa dette dans un autre exercice", () => {
  it("ne change jamais ce qu'on doit, seulement l'unité", () => {
    /**
     * La propriété qui rend l'opération sûre : les points sortent tels qu'ils
     * sont entrés, quel que soit l'exercice visé. Sans elle, un bouton
     * d'affichage deviendrait une écriture.
     */
    for (const e of Object.keys(EXERCICES) as ExerciceId[]) {
      expect(convertirDette(480, e).points).toBe(480);
    }
  });

  it("rend la même quantité que la conversion ordinaire, dette normale", () => {
    // Le module n'invente pas une seconde arithmétique : il ne pose qu'un
    // plancher. Sans ce contrôle, il pourrait dériver de `quantite` sans que
    // rien ne le dise.
    expect(convertirDette(480, "pompes").quantite).toBe(quantite(480, "pompes"));
    expect(convertirDette(480, "boxe").quantite).toBe(quantite(480, "boxe"));
  });

  it("une dette réelle ne se convertit jamais en zéro", () => {
    /**
     * La règle qui a fait écrire ce module. `quantite` arrondit au pas avec
     * `Math.round` : un point converti en course — pas de cent mètres — rend
     * zéro. Affiché tel quel, le bouton dirait « tu ne dois rien » à quelqu'un
     * qui doit encore quelque chose.
     *
     * Le témoin est en dessous : sans lui, ce contrôle passerait sur un
     * arrondi qui ne rendrait jamais zéro, et on ne saurait pas s'il éprouve
     * quoi que ce soit.
     */
    expect(quantite(1, "course")).toBe(0);
    for (const e of Object.keys(EXERCICES) as ExerciceId[]) {
      expect(convertirDette(1, e).quantite).toBeGreaterThan(0);
    }
  });

  it("zéro point rend zéro, et le plancher ne s'y applique pas", () => {
    // La faute inverse, et elle est aussi grave : annoncer cent mètres à
    // courir à quelqu'un qui ne doit rien.
    for (const e of Object.keys(EXERCICES) as ExerciceId[]) {
      expect(convertirDette(0, e).quantite).toBe(0);
    }
    expect(convertirDette(-50, "pompes").quantite).toBe(0);
    expect(convertirDette(Number.NaN, "pompes").points).toBe(0);
  });

  it("n'offre pas de convertir vers ce qu'on doit déjà, quand on n'en doit qu'un", () => {
    const offerts = conversionsPossibles(["boxe"]);
    expect(offerts).not.toContain("boxe");
    expect(offerts).toContain("pompes");
    // Le témoin : une liste vide passerait le contrôle du dessus.
    expect(offerts.length).toBe(Object.keys(EXERCICES).length - 1);
  });

  it("offre tout quand la dette est répartie : la regrouper EST le geste", () => {
    const offerts = conversionsPossibles(["boxe", "pompes"]);
    expect(offerts).toContain("boxe");
    expect(offerts.length).toBe(Object.keys(EXERCICES).length);
  });
});
