import {
  caloriesDePoints, caloriesDeRepartition, minutesDeMarche,
  poidsRetenu, POIDS_PAR_DEFAUT,
} from "./calories";

describe("poids retenu", () => {
  it("prend celui du compte quand il est plausible", () => {
    expect(poidsRetenu(82)).toBe(82);
  });

  it("retombe sur la valeur affichée quand il manque", () => {
    // Beaucoup de comptes n'auront jamais consenti à donner leur poids : c'est
    // leur droit, et ça ne doit pas les priver du chiffre.
    for (const absent of [null, undefined, NaN, 0]) {
      expect(poidsRetenu(absent as number)).toBe(POIDS_PAR_DEFAUT);
    }
  });

  it("écarte une valeur aberrante plutôt que de calculer dessus", () => {
    expect(poidsRetenu(5)).toBe(POIDS_PAR_DEFAUT);
    expect(poidsRetenu(900)).toBe(POIDS_PAR_DEFAUT);
  });
});

describe("énergie dépensée", () => {
  it("croît avec le nombre de points", () => {
    const peu = caloriesDePoints(20, ["pompes"], 70);
    const beaucoup = caloriesDePoints(200, ["pompes"], 70);
    expect(beaucoup).toBeGreaterThan(peu);
  });

  it("croît avec le poids, à effort égal", () => {
    expect(caloriesDePoints(100, ["pompes"], 90))
      .toBeGreaterThan(caloriesDePoints(100, ["pompes"], 60));
  });

  it("reste dans l'ordre de grandeur mesuré d'une pompe", () => {
    /**
     * La littérature situe une pompe entre 0,3 et 0,5 kcal pour 70 kg. Cent
     * pompes doivent donc rendre entre trente et cinquante kilocalories.
     *
     * Cette borne haute a servi : la première version comptait le MET de
     * l'effort sur la durée totale, récupération comprise, et rendait 93 kcal.
     * Le calcul paraissait juste, la fourchette a dit le contraire.
     */
    const cent = caloriesDePoints(100, ["pompes"], 70);
    expect(cent).toBeGreaterThanOrEqual(30);
    expect(cent).toBeLessThanOrEqual(50);
  });

  it("ne rend rien pour zéro point", () => {
    expect(caloriesDePoints(0, ["pompes"], 70)).toBe(0);
  });

  it("ne rend jamais de valeur négative", () => {
    expect(caloriesDePoints(-500, ["pompes"], 70)).toBe(0);
  });

  it("partage entre exercices comme la dette le fait", () => {
    // Un chiffre reposant sur un autre partage annoncerait l'énergie d'un
    // effort que personne n'a produit.
    const partage = caloriesDePoints(100, ["pompes", "boxe"], 70);
    const direct = caloriesDeRepartition({ pompes: 50, boxe: 50 }, 70);
    expect(partage).toBe(direct);
  });

  it("ignore un exercice absent de la ventilation", () => {
    expect(caloriesDeRepartition({ pompes: 40 }, 70))
      .toBe(caloriesDeRepartition({ pompes: 40, squats: 0 }, 70));
  });
});

describe("équivalence en marche", () => {
  it("croît avec l'énergie et décroît avec le poids", () => {
    expect(minutesDeMarche(200, 70)).toBeGreaterThan(minutesDeMarche(100, 70));
    // À énergie égale, une personne plus lourde marche moins longtemps pour la
    // dépenser.
    expect(minutesDeMarche(200, 90)).toBeLessThan(minutesDeMarche(200, 60));
  });

  it("ne rend rien pour une énergie nulle ou négative", () => {
    expect(minutesDeMarche(0, 70)).toBe(0);
    expect(minutesDeMarche(-50, 70)).toBe(0);
  });
});
