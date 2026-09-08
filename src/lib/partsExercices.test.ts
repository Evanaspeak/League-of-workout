import {
  PART_DEFAUT, PART_MAX, PART_MIN,
  parseParts, repartir, repartirPoints, toPart, toExerciceIds,
} from "@/lib/exercices";

/**
 * Le partage entre exercices au choix (réponse 068).
 *
 * Ce que ces contrôles gardent tient en deux choses. D'abord que le DÉFAUT n'a
 * pas bougé : sans poids, le partage doit être celui d'avant, au point près —
 * quelqu'un qui n'ouvre jamais ce réglage ne peut pas voir sa dette se
 * redistribuer parce qu'on a ajouté une fonctionnalité. Ensuite que la somme
 * reste EXACTE : un partage qui perd ou invente un point fait diverger la
 * dette de ce qu'on affiche, et ça ne se rattrape jamais.
 */

const QUATRE = toExerciceIds(["pompes", "squats", "boxe", "abdos"]);

describe("le partage au choix", () => {
  /**
   * Le témoin du défaut, et c'est le contrôle qui compte le plus.
   *
   * Il ne compare pas à une valeur écrite à la main mais à `repartir`, la
   * fonction qui faisait le travail avant : si les deux divergent d'un point
   * sur un seul des huit cents cas, il tombe. Écrit sur trois exemples, il
   * aurait laissé passer un défaut d'arrondi qui ne se voit qu'à un reste
   * précis.
   */
  it("sans poids, rend exactement le partage à parts égales d'avant", () => {
    for (let n = 1; n <= QUATRE.length; n++) {
      const liste = QUATRE.slice(0, n);
      for (let total = 0; total <= 200; total++) {
        const attendu = repartir(total, n);
        const rendu = liste.map((id) => repartirPoints(total, liste)[id]);
        expect(rendu).toEqual(attendu);
      }
    }
  });

  it("un poids vide vaut le défaut, comme l'absence de poids", () => {
    const liste = QUATRE.slice(0, 3);
    expect(repartirPoints(100, liste, {})).toEqual(repartirPoints(100, liste));
  });

  it("respecte les proportions demandées", () => {
    const deux = toExerciceIds(["pompes", "squats"]);
    expect(repartirPoints(100, deux, { pompes: 3, squats: 1 }))
      .toEqual({ pompes: 75, squats: 25 });
    expect(repartirPoints(100, deux, { pompes: 1, squats: 4 }))
      .toEqual({ pompes: 20, squats: 80 });
  });

  it("un exercice sans poids déclaré compte pour un", () => {
    const trois = toExerciceIds(["pompes", "squats", "boxe"]);
    // 2 : 1 : 1 sur dix points, donc 5 · 3 · 2 une fois le reste distribué.
    expect(repartirPoints(10, trois, { pompes: 2 }))
      .toEqual({ pompes: 5, squats: 3, boxe: 2 });
  });

  /**
   * La somme est la seule chose qu'on ne peut pas rattraper : un point perdu
   * ici est une pompe que personne ne fera, un point inventé est une pompe
   * qu'on n'a pas méritée. Éprouvée sur toutes les combinaisons de poids d'un
   * à quatre, pour tous les totaux jusqu'à cent.
   */
  it("la somme reste exacte, quels que soient les poids", () => {
    const trois = toExerciceIds(["pompes", "squats", "boxe"]);
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        for (let c = 1; c <= 4; c++) {
          for (let total = 0; total <= 100; total++) {
            const parts = repartirPoints(total, trois, { pompes: a, squats: b, boxe: c });
            const somme = Object.values(parts).reduce((t, p) => t + (p ?? 0), 0);
            expect(somme).toBe(total);
          }
        }
      }
    }
  });

  /**
   * Le plafond n'est pas une politesse : à un contre mille, la petite part
   * arrondirait à zéro, et un exercice coché qui ne reçoit jamais rien est
   * pire que pas coché. Dix garde toute part au-dessus de zéro dès que la
   * dette dépasse le nombre d'exercices — ce que ce contrôle vérifie au
   * pire écart possible.
   */
  it("au pire écart permis, la petite part reste au-dessus de zéro", () => {
    const deux = toExerciceIds(["pompes", "squats"]);
    for (let total = 11; total <= 400; total++) {
      const parts = repartirPoints(total, deux, { pompes: PART_MAX, squats: PART_MIN });
      expect(parts.squats).toBeGreaterThan(0);
    }
  });

  /**
   * Les bornes vivent à l'ENTRÉE, pas dans l'arithmétique — c'est ce qui
   * permet à la correction d'un résultat de repasser la ventilation d'origine
   * en guise de poids, avec des valeurs bien au-delà de dix, sans la voir
   * ramenée et donc sans perdre ses proportions.
   */
  it("accepte des poids hors bornes quand ils ne viennent pas d'un réglage", () => {
    const deux = toExerciceIds(["pompes", "squats"]);
    expect(repartirPoints(90, deux, { pompes: 60, squats: 30 }))
      .toEqual({ pompes: 60, squats: 30 });
  });

  it("une somme de poids nulle retombe sur les parts égales", () => {
    const deux = toExerciceIds(["pompes", "squats"]);
    expect(repartirPoints(10, deux, { pompes: 0, squats: 0 }))
      .toEqual(repartirPoints(10, deux));
  });

  it("un poids illisible retombe sur le défaut sans emporter les autres", () => {
    const deux = toExerciceIds(["pompes", "squats"]);
    const parts = { pompes: Number.NaN, squats: 1 } as Record<string, number>;
    expect(repartirPoints(10, deux, parts)).toEqual({ pompes: 5, squats: 5 });
  });
});

describe("les bornes d'un poids choisi", () => {
  it("zéro est refusé : décocher dit déjà la même chose", () => {
    expect(toPart(0)).toBe(PART_MIN);
    expect(toPart(-3)).toBe(PART_MIN);
  });

  it("le plafond tient", () => {
    expect(toPart(1000)).toBe(PART_MAX);
  });

  it("ce qui n'est pas un nombre vaut le défaut", () => {
    expect(toPart("beaucoup")).toBe(PART_DEFAUT);
    expect(toPart(undefined)).toBe(PART_DEFAUT);
    expect(toPart(Number.POSITIVE_INFINITY)).toBe(PART_DEFAUT);
  });
});

describe("la relecture des poids rangés en base", () => {
  it("lit ce qui a été écrit", () => {
    expect(parseParts('{"pompes":3,"squats":1}')).toEqual({ pompes: 3, squats: 1 });
  });

  /**
   * Un contenu illisible retombe sur des poids vides, donc sur le partage à
   * parts égales. Le repli d'un réglage de confort ne peut pas être plus
   * surprenant que son absence.
   */
  it.each([
    ["une colonne nulle", null],
    ["une chaîne vide", ""],
    ["du JSON cassé", "{pompes:"],
    ["un tableau", "[1,2]"],
    ["un nombre", "42"],
    ["null en JSON", "null"],
  ])("%s rend des poids vides", (_titre, brut) => {
    expect(parseParts(brut)).toEqual({});
  });

  it("écarte les exercices inconnus et borne le reste", () => {
    expect(parseParts('{"pompes":99,"licorne":2,"squats":0}'))
      .toEqual({ pompes: PART_MAX, squats: PART_MIN });
  });
});
