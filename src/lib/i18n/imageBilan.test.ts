import { motsImage } from "./imageBilan";
import { LANGUES } from "./langues";

/**
 * Les mots de l'image du bilan.
 *
 * Ils ne passent pas par `useT` : l'image est dessinée au serveur. C'est
 * exactement la situation où un texte écrit en dur part en français à tout le
 * monde sans que personne ne le remarque — celui qui écrit l'application la
 * lit en français.
 */
describe("les mots de l'image", () => {
  test("les six langues sont servies", () => {
    for (const langue of LANGUES) {
      const m = motsImage(langue);
      for (const cle of ["parties", "victoires", "paye", "serie"] as const) {
        expect(typeof m[cle]).toBe("string");
        expect(m[cle].length).toBeGreaterThan(0);
      }
      expect(m.periode(90)).toContain("90");
    }
  });

  test("elles disent vraiment six choses différentes", () => {
    // Un dictionnaire recopié six fois passerait le test précédent.
    const vus = new Set(LANGUES.map((l) => motsImage(l).parties));
    expect(vus.size).toBe(LANGUES.length);
  });

  test("une langue inconnue retombe sur l'anglais, jamais sur du vide", () => {
    for (const mauvais of [null, undefined, "", "kl", 7, {}]) {
      expect(motsImage(mauvais)).toEqual(motsImage("en"));
    }
  });
});
