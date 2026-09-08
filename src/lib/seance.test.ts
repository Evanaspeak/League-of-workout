import { exerciceCompte, veilleADemander } from "./seance";

/**
 * Ce qu'une séance montre, et quand (ligne 205 du plan).
 *
 * Les deux décisions vivent ici plutôt que dans `CompteurDette`, qui fait sept
 * cent lignes : c'est la règle du projet, et elle vaut d'autant plus ici que
 * l'erreur se paie en effort qu'on n'a pas fait.
 */

describe("l'exercice que la séance compte", () => {
  test("compte ce qu'on doit, quand la dette tient dans un seul exercice", () => {
    // Le compteur n'existait que pour les CONVERSIONS : quelqu'un qui doit
    // trente-huit pompes n'avait que « c'est fait » ou « plus tard », donc
    // tout ou rien, alors qu'une série ne suffit pas.
    expect(exerciceCompte(["pompes"], null)).toBe("pompes");
    expect(exerciceCompte(["squats"], null)).toBe("squats");
  });

  test("ne compte pas un exercice mesuré au TEMPS", () => {
    // Une planche se chronomètre, elle ne se tape pas.
    expect(exerciceCompte(["boxe"], null)).toBeNull();
    expect(exerciceCompte(["planche"], null)).toBeNull();
  });

  /**
   * Le cas qui décide de la forme de la fonction.
   *
   * Compter sur l'un des deux exercices paierait l'autre sans qu'on l'ait
   * fait : la dette est un total en points, et le compteur ne sait pas dire
   * lequel des deux on est en train de faire. C'est la conversion qui existe
   * pour regrouper, et elle est proposée à la préparation.
   */
  test("ne choisit pas à la place de quelqu'un quand la dette est partagée", () => {
    expect(exerciceCompte(["pompes", "squats"], null)).toBeNull();
    expect(exerciceCompte(["boxe", "pompes"], null)).toBeNull();
  });

  test("la conversion l'emporte sur tout le reste", () => {
    // On a choisi explicitement : c'est ce choix qu'on compte, y compris sous
    // une dette au temps — c'est tout l'objet de la conversion.
    expect(exerciceCompte(["boxe"], "pompes")).toBe("pompes");
    expect(exerciceCompte(["pompes", "squats"], "tractions")).toBe("tractions");
  });

  test("sans dette, il n'y a rien à compter", () => {
    expect(exerciceCompte([], null)).toBeNull();
  });
});

describe("le verrou de veille", () => {
  /**
   * Il ne se demande que PENDANT la séance.
   *
   * Garder l'écran allumé sur une préparation qu'on lit, ou pire sur une
   * fenêtre fermée, est de la pile vidée pour rien.
   */
  test("pendant la séance, et seulement là", () => {
    expect(veilleADemander("encours", true)).toBe(true);
    expect(veilleADemander("preparation", true)).toBe(false);
    expect(veilleADemander("encours", false)).toBe(false);
    expect(veilleADemander("preparation", false)).toBe(false);
  });
});
