import { premiereSemaine, OBJECTIF_PARTIES, JOURS_FENETRE } from "./premiereSemaine";

const MAINTENANT = new Date("2026-08-23T12:00:00Z");
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * 24 * 3600_000);

describe("objectif de première semaine", () => {
  it("compte ce qu'il reste à faire", () => {
    const e = premiereSemaine(ilYA(1), 2, MAINTENANT);
    expect(e.restantes).toBe(OBJECTIF_PARTIES - 2);
    expect(e.atteint).toBe(false);
    expect(e.visible).toBe(true);
  });

  it("disparaît une fois atteint", () => {
    // Un objectif atteint qui reste affiché n'est plus un objectif.
    const e = premiereSemaine(ilYA(1), OBJECTIF_PARTIES, MAINTENANT);
    expect(e.atteint).toBe(true);
    expect(e.visible).toBe(false);
    expect(e.restantes).toBe(0);
  });

  it("disparaît au bout de la fenêtre, atteint ou non", () => {
    // Un objectif raté qui reste affiché n'est plus un objectif, c'est un
    // reproche.
    const e = premiereSemaine(ilYA(JOURS_FENETRE), 1, MAINTENANT);
    expect(e.visible).toBe(false);
  });

  it("compte les jours restants du premier au dernier", () => {
    expect(premiereSemaine(ilYA(0), 0, MAINTENANT).joursRestants).toBe(6);
    expect(premiereSemaine(ilYA(6), 0, MAINTENANT).joursRestants).toBe(0);
  });

  it("ne montre rien sans date d'inscription lisible", () => {
    // Sans elle, on ne sait pas où en est la fenêtre : ne rien montrer est la
    // seule réponse honnête, et l'objectif ne doit surtout pas rester à vie.
    for (const rebut of [null, undefined, "pas une date"]) {
      expect(premiereSemaine(rebut, 0, MAINTENANT).visible).toBe(false);
    }
  });

  it("encaisse un compte de parties absurde", () => {
    expect(premiereSemaine(ilYA(1), NaN, MAINTENANT).parties).toBe(0);
    expect(premiereSemaine(ilYA(1), -3, MAINTENANT).parties).toBe(0);
  });
});
