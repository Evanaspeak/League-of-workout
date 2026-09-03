import { CONDUITES, CONDUITE_DEFAUT, toConduiteSession } from "./sessionAuto";

describe("la conduite au démarrage d'un jeu", () => {
  it("accepte les trois valeurs prévues", () => {
    for (const c of CONDUITES) expect(toConduiteSession(c)).toBe(c);
  });

  it("retombe sur « demander » pour tout le reste", () => {
    // Une valeur inventée ne doit pas faire démarrer une session toute seule :
    // le repli est celui qui ne décide rien à la place de la personne.
    for (const brut of [null, undefined, "", "AUTO", 1, {}, ["auto"]]) {
      expect(toConduiteSession(brut)).toBe("demander");
    }
  });

  it("demande par défaut, plutôt que de lancer", () => {
    // C'est la décision de produit, et elle mérite d'être fixée : une session
    // qui s'ouvre sans qu'on l'ait voulu décide de ce qui entre dans la dette.
    expect(CONDUITE_DEFAUT).toBe("demander");
  });
});
