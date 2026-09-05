import { EXERCICES, EXERCICE_IDS, RATIOS_DEFAUT, type ExerciceId } from "./exercices";

/**
 * Un point d'effort coûte à peu près le même TEMPS, quel que soit l'exercice.
 *
 * C'est le principe que le catalogue énonce depuis le début, exercice par
 * exercice — « cent points font deux kilomètres, soit à peu près le temps que
 * demandent cent pompes », « vingt tractions pour cent points, soit à peu près
 * le même temps » — et que rien ne tenait. C'est pourtant lui qui rend le
 * choix d'exercice LIBRE : si l'un coûtait deux fois le temps d'un autre pour
 * la même dette, il n'y aurait plus de choix, il y aurait un piège.
 *
 * Éprouvé sur le premier jet des pompes murales, qui l'a violé : trois
 * répétitions de quatre secondes faisaient douze secondes par point contre six
 * pour une pompe au sol. Un exercice ADAPTÉ qui demande le double de temps
 * n'est pas accessible, c'est une punition — et c'est exactement l'inverse de
 * ce que la réponse 260 demandait.
 *
 * La fourchette est large parce que le catalogue l'est : de quatre secondes
 * (tractions) à sept et demie (squats). Elle n'existe pas pour affiner un
 * barème, elle existe pour attraper un facteur deux.
 */

const PLANCHER = 3;
const PLAFOND = 9;

/**
 * Secondes de travail pour un point d'effort.
 *
 * Deux formes, et il faut les deux : un exercice compté en TEMPS a un `ratio`
 * qui donne directement des secondes ; les autres comptent des répétitions ou
 * des kilomètres, et il faut multiplier par ce que coûte l'unité.
 */
export function secondesParPoint(id: ExerciceId): number {
  const def = EXERCICES[id];
  const ratio = RATIOS_DEFAUT[id];
  if (def.unite === "temps") return ratio;
  if (def.secondesParRep === undefined) {
    throw new Error(`${id} compte des ${def.unite} sans dire ce que coûte une unité`);
  }
  return ratio * def.secondesParRep;
}

describe("le temps d'un point d'effort", () => {
  it("est comparable d'un exercice à l'autre", () => {
    const hors: string[] = [];
    let examines = 0;
    for (const id of EXERCICE_IDS) {
      examines += 1;
      const s = secondesParPoint(id);
      if (!(s >= PLANCHER && s <= PLAFOND)) hors.push(`${id} → ${s.toFixed(2)} s`);
    }
    // Témoin : un catalogue vidé rendrait la liste vide sans rien avoir mesuré.
    expect(examines).toBeGreaterThanOrEqual(8);
    expect(hors).toEqual([]);
  });

  it("est défini pour chaque exercice du catalogue", () => {
    for (const id of EXERCICE_IDS) {
      expect(() => secondesParPoint(id)).not.toThrow();
      expect(Number.isFinite(secondesParPoint(id))).toBe(true);
    }
  });

  /**
   * Les deux exercices ADAPTÉS (réponse 260) sont dans la bande comme les
   * autres, et c'est tout l'objet : « adapté » veut dire qu'on peut le faire,
   * pas qu'il coûte moins cher ni qu'il prend plus longtemps.
   */
  it("vaut aussi pour les exercices adaptés", () => {
    for (const id of ["pompesMurales", "marche"] as ExerciceId[]) {
      const s = secondesParPoint(id);
      expect(s).toBeGreaterThanOrEqual(PLANCHER);
      expect(s).toBeLessThanOrEqual(PLAFOND);
    }
    // Une pompe murale est plus FACILE : il en faut davantage pour un point.
    expect(RATIOS_DEFAUT.pompesMurales).toBeGreaterThan(RATIOS_DEFAUT.pompes);
    // Et elle ne peut jamais devenir plus chère qu'une pompe au sol.
    expect(EXERCICES.pompesMurales.secondesParRep!)
      .toBeLessThan(EXERCICES.pompes.secondesParRep!);
  });

  /**
   * Les deux formes de calcul s'éprouvent sur des cas fabriqués : le
   * catalogue réel ne distingue pas une formule juste d'une formule qui
   * ignorerait `secondesParRep`.
   */
  it("distingue un exercice compté en temps d'un exercice compté en unités", () => {
    // `boxe` est en temps : son ratio EST le nombre de secondes.
    expect(secondesParPoint("boxe")).toBe(RATIOS_DEFAUT.boxe);
    // `pompes` compte des répétitions : ratio × secondes par répétition.
    expect(secondesParPoint("pompes"))
      .toBe(RATIOS_DEFAUT.pompes * EXERCICES.pompes.secondesParRep!);
    // Et les deux ne se confondent pas : la course rendrait 0,02 si l'on
    // oubliait de multiplier.
    expect(secondesParPoint("course")).toBeGreaterThan(1);
  });
});
