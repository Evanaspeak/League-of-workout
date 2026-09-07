import { calculerMesures, equilibreJeux, formaterDelai, quantile, type CompteMesure } from "./mesures";

const T0 = new Date("2026-08-01T10:00:00Z");
const apres = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const compte = (
  premiereEnMinutes: number | null, joursActifs = 1,
): CompteMesure => ({
  cree: T0,
  premierePartie: premiereEnMinutes === null ? null : apres(premiereEnMinutes),
  joursActifs: premiereEnMinutes === null ? 0 : joursActifs,
});

describe("quantile", () => {
  it("interpole plutôt que de prendre la valeur du bas", () => {
    // Sur un nombre pair de valeurs, prendre la valeur basse déplace la
    // médiane de plusieurs heures quand on a cinq utilisateurs.
    expect(quantile([10, 20], 0.5)).toBe(15);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("rend la valeur unique d'une série d'un seul élément", () => {
    expect(quantile([42], 0.5)).toBe(42);
    expect(quantile([42], 0.25)).toBe(42);
  });

  it("ne rend rien sur une série vide, plutôt que zéro", () => {
    // Zéro se lirait comme « ils jouent tout de suite », ce qui est le
    // contraire de « on ne sait pas ».
    expect(quantile([], 0.5)).toBeNull();
  });

  it("borne le quantile demandé", () => {
    expect(quantile([1, 2, 3], -1)).toBe(1);
    expect(quantile([1, 2, 3], 9)).toBe(3);
  });
});

describe("mesures d'usage", () => {
  it("compte les comptes actifs et leur part", () => {
    const m = calculerMesures([compte(30), compte(90), compte(null), compte(null)]);
    expect(m.comptes).toBe(4);
    expect(m.avecPartie).toBe(2);
    expect(m.partActifs).toBe(50);
  });

  it("écarte un délai négatif au lieu de le compter à zéro", () => {
    // Les parties enregistrées avant que la date d'enregistrement n'existe ont
    // repris la date de partie, qui peut précéder l'inscription. Les compter à
    // zéro tirerait la médiane vers le bas sans qu'on le voie.
    const m = calculerMesures([compte(-500), compte(60), compte(120)]);
    expect(m.delai.median).toBe(90);
  });

  it("distingue la journée de la semaine", () => {
    const m = calculerMesures([compte(30), compte(60 * 30), compte(60 * 24 * 6), compte(60 * 24 * 30)]);
    expect(m.dansLaJournee).toBe(1);
    expect(m.dansLaSemaine).toBe(3);
  });

  it("compte comme revenu celui qui a joué deux jours différents", () => {
    const m = calculerMesures([compte(10, 1), compte(10, 2), compte(10, 9), compte(null)]);
    expect(m.revenus).toBe(2);
  });

  it("ne divise pas par zéro sur une base vide", () => {
    const m = calculerMesures([]);
    expect(m.comptes).toBe(0);
    expect(m.partActifs).toBe(0);
    expect(m.delai.median).toBeNull();
  });

  it("ne rend pas de délai quand personne n'a joué", () => {
    const m = calculerMesures([compte(null), compte(null)]);
    expect(m.delai.median).toBeNull();
    expect(m.avecPartie).toBe(0);
  });
});

describe("lecture d'une durée", () => {
  it("passe des minutes aux heures puis aux jours", () => {
    expect(formaterDelai(45)).toBe("45 min");
    expect(formaterDelai(60)).toBe("1 h");
    expect(formaterDelai(130)).toBe("2 h 10");
    expect(formaterDelai(60 * 24 * 3)).toBe("3 j");
    expect(formaterDelai(60 * 24 * 3 + 120)).toBe("3 j 2 h");
  });

  it("dit qu'on ne sait pas, plutôt que zéro", () => {
    expect(formaterDelai(null)).toBe("—");
  });
});

describe("l'équilibre entre les jeux (réponse 185)", () => {
  const j = (jeu: string, parties: number, moyenne: number) => ({ jeu, parties, moyenne });

  it("range du plus cher au moins cher et rend le rapport", () => {
    const e = equilibreJeux([j("A", 20, 30), j("B", 20, 12), j("C", 20, 20)]);
    expect(e.jeux.map((x) => x.jeu)).toEqual(["A", "C", "B"]);
    expect(e.facteur).toBe(2.5);
    expect(e.derape).toBe(true);
    expect(e.compares).toBe(3);
  });

  it("ne crie pas sous le seuil", () => {
    const e = equilibreJeux([j("A", 20, 30), j("B", 20, 20)]);
    expect(e.facteur).toBe(1.5);
    expect(e.derape).toBe(false);
  });

  it("crie À PARTIR du seuil, pas seulement au-dessus", () => {
    // « deux fois plus » est la réponse : à deux exactement, ça compte.
    const e = equilibreJeux([j("A", 20, 40), j("B", 20, 20)]);
    expect(e.facteur).toBe(2);
    expect(e.derape).toBe(true);
  });

  it("liste un jeu trop rare mais ne le compare pas", () => {
    // Sans ce plancher, une seule partie malheureuse décide du facteur.
    const e = equilibreJeux([j("A", 20, 20), j("B", 20, 18), j("Rare", 1, 200)]);
    expect(e.jeux.map((x) => x.jeu)).toContain("Rare");
    expect(e.compares).toBe(2);
    expect(e.derape).toBe(false);
  });

  it("ne divise pas par une moyenne nulle", () => {
    // Le rapport n'a alors pas de valeur, et rendre l'infini ferait crier
    // l'écran sans rien lui apprendre.
    const e = equilibreJeux([j("A", 20, 20), j("Gratuit", 20, 0)]);
    expect(e.facteur).toBeNull();
    expect(e.derape).toBe(false);
  });

  it("ne rend aucun rapport avec un seul jeu comparable", () => {
    const e = equilibreJeux([j("A", 20, 20), j("B", 3, 60)]);
    expect(e.facteur).toBeNull();
  });
});
