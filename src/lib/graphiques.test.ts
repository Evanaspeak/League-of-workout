/**
 * Une couleur par nature de donnée, jamais deux pour la même.
 *
 * C'est la règle écrite au-dessus de `TEINTES`, et c'est la seule chose de ce
 * module qui puisse être fausse : le reste n'est que des valeurs. Deux séries
 * de la même teinte sur un même écran ne se distinguent plus, et le défaut se
 * voit d'autant moins qu'il ne casse rien — les deux graphiques s'affichent.
 *
 * Le module ne rend rien d'autre que des constantes, donc le test ne les
 * répète pas : il éprouve la propriété, pas la valeur.
 */
import { GRILLE_TRAIT, INFOBULLE, RAYON_BARRE, TEINTES } from "@/lib/graphiques";

describe("les teintes des séries", () => {
  it("sont toutes distinctes", () => {
    const valeurs = Object.values(TEINTES);
    expect(new Set(valeurs).size).toBe(valeurs.length);
  });

  // Sans ce contrôle, une table vidée passerait le test précédent : zéro
  // valeur, zéro doublon.
  it("couvrent les quatre natures de donnée", () => {
    expect(Object.keys(TEINTES).sort()).toEqual(["dette", "jeux", "moyenne", "periode"]);
  });

  /**
   * Ce contrôle disait l'INVERSE, et il avait figé une prémisse fausse.
   *
   * Il exigeait un hexadécimal, au motif que « recharts ne lit pas la feuille
   * de style, donc un nom de jeton ne serait jamais résolu ». Mesuré, sur
   * trois rectangles SVG — attribut de présentation, style en ligne, littéral —
   * les trois rendent la même couleur : `fill="var(--amber)"` se résout.
   * Vérifié ensuite sur le vrai tableau de bord, huit barres et deux courbes :
   * l'attribut vaut `var(--amber)` et la couleur CALCULÉE `rgb(255, 180, 84)`,
   * aucune barre noire.
   *
   * C'est la forme la plus coûteuse d'un mauvais test : il ne se contentait
   * pas de ne rien attraper, il interdisait la correction. Il dit maintenant
   * ce qu'on veut vraiment — que les teintes viennent de la PALETTE, donc
   * qu'un changement de marque les emporte au lieu de les laisser derrière.
   */
  it("lisent la palette plutôt que de la recopier", () => {
    for (const c of Object.values(TEINTES)) expect(c).toMatch(/^var\(--[a-z0-9-]+\)$/);
    expect(INFOBULLE.background).toMatch(/^var\(--[a-z0-9-]+\)$/);
    expect(INFOBULLE.color).toMatch(/^var\(--[a-z0-9-]+\)$/);
    // Le quadrillage et la bordure de l'infobulle n'ont pas de nom dans la
    // palette : les nommer est une décision de palette, pas une correction.
    expect(GRILLE_TRAIT).toMatch(/^rgba?\(/);
  });
});

describe("le rayon d'une barre", () => {
  /** Arrondie en haut seulement, comme une colonne posée sur son axe. */
  it("n'arrondit que les deux coins du haut", () => {
    expect(RAYON_BARRE).toEqual([2, 2, 0, 0]);
  });
});
