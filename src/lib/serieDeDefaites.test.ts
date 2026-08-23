import {
  defaitesDAffilee, ECART_MAX_MS, SEUIL_DEFAITES, suggererUnePause,
} from "./serieDeDefaites";

const T = new Date("2026-08-23T22:00:00Z");
const ilYA = (minutes: number) => new Date(T.getTime() - minutes * 60_000);

const partie = (minutes: number, result: string) => ({ date: ilYA(minutes), result });

describe("série de défaites", () => {
  it("compte les défaites consécutives les plus récentes", () => {
    const parties = [partie(10, "D"), partie(45, "D"), partie(80, "D"), partie(120, "V")];
    expect(defaitesDAffilee(parties, T)).toBe(3);
  });

  it("s'arrête à la première victoire", () => {
    expect(defaitesDAffilee([partie(10, "D"), partie(40, "V"), partie(70, "D")], T)).toBe(1);
  });

  it("ne compte rien quand la dernière est gagnée", () => {
    expect(defaitesDAffilee([partie(5, "V"), partie(40, "D")], T)).toBe(0);
  });

  it("ferme la séance au-delà de l'écart", () => {
    // Trois défaites étalées sur trois semaines ne sont pas une soirée
    // difficile : personne ne comprendrait de quoi on parle.
    const vieux = new Date(T.getTime() - ECART_MAX_MS - 60_000);
    expect(defaitesDAffilee([{ date: vieux, result: "D" }], T)).toBe(0);
  });

  it("ferme la séance à un trou au milieu", () => {
    const parties = [
      partie(10, "D"),
      partie(40, "D"),
      // Cinq heures plus tôt : une autre soirée.
      partie(40 + 5 * 60, "D"),
    ];
    expect(defaitesDAffilee(parties, T)).toBe(2);
  });

  it("ne compte pas une session au temps comme une défaite", () => {
    // Les jeux comptés au temps n'ont pas de résultat : leur `result` ne vaut
    // ni « V » ni « D », et ils ne doivent pas nourrir la série.
    expect(defaitesDAffilee([partie(10, "T"), partie(40, "D")], T)).toBe(0);
  });

  it("rend zéro sans partie", () => {
    expect(defaitesDAffilee([], T)).toBe(0);
  });
});

describe("suggestion", () => {
  it("ne dit rien en deçà du seuil", () => {
    const parties = Array.from({ length: SEUIL_DEFAITES - 1 }, (_, i) => partie(10 + i * 30, "D"));
    expect(suggererUnePause(parties, T)).toBe(false);
  });

  it("le dit au seuil", () => {
    const parties = Array.from({ length: SEUIL_DEFAITES }, (_, i) => partie(10 + i * 30, "D"));
    expect(suggererUnePause(parties, T)).toBe(true);
  });
});
