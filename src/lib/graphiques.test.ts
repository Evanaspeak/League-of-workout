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
   * Recharts ne lit pas la feuille de style : ses couleurs partent en
   * propriétés JavaScript, donc elles doivent être des couleurs valides et non
   * des noms de jetons CSS, qui ne seraient jamais résolus.
   */
  it("s'écrivent en couleurs que le navigateur comprend hors CSS", () => {
    for (const c of Object.values(TEINTES)) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(INFOBULLE.background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(GRILLE_TRAIT).toMatch(/^rgba?\(/);
  });
});

describe("le rayon d'une barre", () => {
  /** Arrondie en haut seulement, comme une colonne posée sur son axe. */
  it("n'arrondit que les deux coins du haut", () => {
    expect(RAYON_BARRE).toEqual([2, 2, 0, 0]);
  });
});
