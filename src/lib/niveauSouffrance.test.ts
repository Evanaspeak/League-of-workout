import {
  avancementSouffrance, seuilSouffrance, souffrancePourPoints, PAS_SOUFFRANCE,
} from "./niveauSouffrance";

describe("le niveau de souffrance", () => {
  it("garde le pas de la courbe", () => {
    /**
     * Un pin, pas une vérification : la courbe décide de ce que valent des
     * mois d'effort, et elle ne doit pas changer en silence. Si ce test tombe,
     * c'est qu'on a changé la progression de tout le monde — ce qui se fait,
     * mais en le sachant et en l'écrivant.
     */
    expect(PAS_SOUFFRANCE).toBe(50);
    expect([2, 3, 4, 5].map(seuilSouffrance)).toEqual([100, 300, 600, 1000]);
  });

  it("commence au niveau 1, et n'en descend jamais", () => {
    // Un compte neuf n'a rien payé. « Niveau 0 » n'existe pas, et un nombre
    // négatif traverserait une barre de progression sans bruit.
    for (const p of [0, -1, -9999, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(souffrancePourPoints(p)).toBe(1);
    }
    expect(avancementSouffrance(-5).points).toBe(0);
  });

  it("ne compte QUE l'effort payé, exprimé en points", () => {
    // Cent pompes payées, c'est le niveau 2 : deux ou trois défaites soldées.
    expect(souffrancePourPoints(99)).toBe(1);
    expect(souffrancePourPoints(100)).toBe(2);
    expect(souffrancePourPoints(1000)).toBe(5);
  });

  it("est exact AU SEUIL, sur trois cent mille niveaux", () => {
    /**
     * La forme fermée emploie une racine carrée flottante, et le réflexe est
     * de la corriger par des comparaisons « au cas où » elle rendrait
     * 2,9999997 au seuil exact — donc précisément à l'instant qu'on veut
     * fêter. Cette correction ne tient rien : au seuil du niveau n,
     * `1 + 4 points / PAS` vaut `(2n − 1)²`, un carré parfait, dont la racine
     * est exacte en IEEE 754.
     *
     * On ne le croit pas sur parole, on le vérifie — et on COMPTE les tours,
     * sans quoi une boucle vide rendrait une liste d'écarts vide et le test
     * passerait en n'ayant rien mesuré.
     */
    const ecarts: string[] = [];
    let tours = 0;
    for (let n = 2; n <= 300_000; n += 1) {
      tours += 1;
      const seuil = seuilSouffrance(n);
      if (souffrancePourPoints(seuil) !== n) ecarts.push(`au seuil de ${n}`);
      if (souffrancePourPoints(seuil - 1) !== n - 1) ecarts.push(`juste sous ${n}`);
    }
    expect(tours).toBe(299_999);
    expect(ecarts).toEqual([]);
  });

  it("rend un avancement borné et cohérent", () => {
    const a = avancementSouffrance(450);
    expect(a).toMatchObject({ niveau: 3, points: 450, seuil: 300, prochain: 600, restant: 150 });
    expect(a.part).toBeCloseTo(0.5, 5);
    // Pile au seuil : on entre dans le niveau, la barre repart de zéro.
    expect(avancementSouffrance(300)).toMatchObject({ niveau: 3, part: 0 });
  });

  it("ne se confond pas avec le niveau de compte", () => {
    /**
     * La distinction que le propriétaire a demandée, tenue par un cas : un
     * compte qui joue beaucoup sans jamais rien payer reste au niveau de
     * souffrance 1. C'est tout l'objet du chiffre — on ne souffre pas de ce
     * qu'on doit, on souffre de ce qu'on fait.
     */
    expect(avancementSouffrance(0).niveau).toBe(1);
    expect(avancementSouffrance(0).restant).toBe(100);
  });
});
