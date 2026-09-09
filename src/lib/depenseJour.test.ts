import {
  KCAL_MAX, KCAL_MIN_SANS_PROFIL, objectifMesure, verdictDepense,
} from "./depenseJour";
import { metabolismeBase, objectifCalorique, type Mesures } from "./objectifCalorique";

/**
 * La dépense mesurée d'une journée, et le piège qu'elle ferme.
 *
 * Une montre affiche DEUX chiffres — les calories actives et la dépense
 * totale — qui diffèrent d'un facteur trois. Prendre les premières pour la
 * seconde diviserait l'objectif par trois, sur une grandeur qui touche à la
 * santé. C'est le piège de `totalPoints` contre `pointsPayes`, et il se ferme
 * par un plancher PHYSIOLOGIQUE : un corps dépense son métabolisme de base
 * rien qu'en restant couché.
 */
const M: Mesures = {
  formule: "h", poids: 80, taille: 180, age: 30, activite: "modere",
};

describe("verdictDepense", () => {
  it("accepte une dépense de journée plausible", () => {
    expect(verdictDepense(2_640, M)).toBe("ok");
  });

  it("refuse les calories ACTIVES prises pour le total, en le disant", () => {
    // Le métabolisme de base de ce profil vaut 1 780 : six cents kilocalories
    // sont un très bon jour d'exercice, et une dépense de journée impossible.
    const base = metabolismeBase(M);
    expect(base).toBeGreaterThan(1_500);
    expect(verdictDepense(600, M)).toBe("sous-le-metabolisme");
    // Et le verdict est DISTINCT du refus ordinaire : les deux ne se
    // corrigent pas de la même façon.
    expect(verdictDepense(600, M)).not.toBe("trop-bas");
  });

  it("laisse passer une petite journée qui reste au-dessus du métabolisme", () => {
    expect(verdictDepense(metabolismeBase(M) + 1, M)).toBe("ok");
  });

  it("garde un plancher quand le profil n'est pas rempli", () => {
    // Sans mesures, aucun métabolisme à comparer — mais un zéro de trop se
    // rattrape quand même.
    expect(verdictDepense(900, null)).toBe("trop-bas");
    expect(verdictDepense(KCAL_MIN_SANS_PROFIL, null)).toBe("ok");
  });

  it("refuse ce qu'aucun corps ne dépense", () => {
    // Le plafond couvre une étape du Tour de France, la dépense quotidienne
    // la plus haute jamais mesurée.
    expect(verdictDepense(KCAL_MAX + 1, M)).toBe("trop-haut");
    expect(verdictDepense(Number.NaN, M)).toBe("trop-bas");
    expect(verdictDepense(Number.POSITIVE_INFINITY, M)).toBe("trop-haut");
  });
});

describe("objectifMesure", () => {
  it("remplace l'estimation par la mesure du jour", () => {
    // L'estimation de ce profil vaut 1 780 × 1,55 = 2 759. Une journée
    // mesurée à 3 200 doit donner un objectif plus haut, et l'écart doit être
    // celui du mode — pas une moyenne inventée entre les deux.
    const estime = objectifCalorique(M, "perte");
    const mesure = objectifMesure(M, "perte", 3_200);
    expect(mesure.maintien).toBe(3_200);
    expect(mesure.cible).toBe(Math.round(3_200 * 0.8));
    expect(mesure.cible).toBeGreaterThan(estime.cible);
  });

  it("applique l'écart de chaque mode, et rien d'autre", () => {
    expect(objectifMesure(M, "maintien", 2_500).cible).toBe(2_500);
    expect(objectifMesure(M, "prise", 2_500).cible).toBe(2_750);
  });

  it("avertit sur la valeur AFFICHÉE, pas sur l'estimation", () => {
    /**
     * C'est le contrôle qui distingue vraiment quelque chose. L'estimation de
     * ce profil ne franchit PAS le plancher de 1 500 ; une petite journée
     * mesurée, elle, le franchit. Un avertissement calculé sur l'estimation
     * resterait donc muet au moment précis où il sert.
     */
    expect(objectifCalorique(M, "perte").sousPlancher).toBe(false);
    expect(objectifMesure(M, "perte", 1_800).sousPlancher).toBe(true);
  });

  it("ne rend aucune date, aucune échéance (réponse 016)", () => {
    const rendu = JSON.stringify(objectifMesure(M, "perte", 2_600));
    expect(rendu).not.toMatch(/semaine|jours|date|echeance|échéance/i);
  });
});
