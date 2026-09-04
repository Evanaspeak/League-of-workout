import { estGrosseSeance, PLANCHER_POINTS } from "@/lib/grosseSeance";

describe("ce qui fait une grosse séance", () => {
  test("un record de la fenêtre, au-dessus du plancher", () => {
    expect(estGrosseSeance(200, [150, 80])).toBe(true);
  });

  test("sous le plancher, jamais — même sans rien à battre", () => {
    // La toute première séance est toujours un record : sans plancher, on
    // proposerait de partager quatre pompes.
    expect(estGrosseSeance(PLANCHER_POINTS - 1, [])).toBe(false);
    expect(estGrosseSeance(4, [])).toBe(false);
  });

  test("au plancher pile, et rien à battre : oui", () => {
    expect(estGrosseSeance(PLANCHER_POINTS, [])).toBe(true);
  });

  test("battu par une séance de la fenêtre : non", () => {
    expect(estGrosseSeance(200, [201])).toBe(false);
  });

  test("égaler son record n'est pas le battre", () => {
    // Sinon la même image se propose deux fois pour le même chiffre, ce qui
    // est exactement la sollicitation qu'on veut éviter.
    expect(estGrosseSeance(200, [200])).toBe(false);
  });

  test("une valeur qui n'est pas un nombre ne propose rien", () => {
    expect(estGrosseSeance(Number.NaN, [])).toBe(false);
    expect(estGrosseSeance(Number.POSITIVE_INFINITY, [])).toBe(false);
  });
});
