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

  it("reste affiché une fois atteint, dans son état atteint", () => {
    // Il s'effaçait à la seconde où on l'atteignait : réussir et ignorer
    // produisaient exactement le même écran, c'est-à-dire rien. Un objectif
    // raté qu'on laisse est un reproche ; un objectif réussi qu'on laisse est
    // un trophée. Les deux ne se traitent pas pareil.
    const e = premiereSemaine(ilYA(1), OBJECTIF_PARTIES, MAINTENANT);
    expect(e.atteint).toBe(true);
    expect(e.visible).toBe(true);
    expect(e.restantes).toBe(0);
  });

  it("le trophée s'en va quand même au bout de la fenêtre", () => {
    // Une réussite qu'on affiche indéfiniment finit par ne plus rien dire, et
    // occupe la place de ce qui vient après.
    const e = premiereSemaine(ilYA(JOURS_FENETRE), OBJECTIF_PARTIES, MAINTENANT);
    expect(e.atteint).toBe(true);
    expect(e.visible).toBe(false);
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

  it("borne ce qu'on AFFICHE à la cible, pas ce qu'on compte", () => {
    /**
     * Trouvé en lisant le tableau de bord d'un compte à neuf cent soixante
     * activités : il annonçait « 960 sur 5 », dessinait une barre de dix-neuf
     * mille pour cent, et donnait à un lecteur d'écran un `aria-valuenow` de
     * 960 pour un maximum de 5 — ce qui n'est pas un état valide.
     *
     * Le compte réel reste dans `parties` ; c'est `avancement` qu'on montre.
     */
    const gros = premiereSemaine(new Date("2026-09-01T00:00:00Z"), 960,
      new Date("2026-09-03T00:00:00Z"));
    expect(gros.parties).toBe(960);
    expect(gros.avancement).toBe(OBJECTIF_PARTIES);
    expect(gros.atteint).toBe(true);

    // En dessous de la cible, les deux disent la même chose : la borne ne
    // doit pas se mettre à mentir dans l'autre sens.
    const petit = premiereSemaine(new Date("2026-09-01T00:00:00Z"), 3,
      new Date("2026-09-03T00:00:00Z"));
    expect(petit.avancement).toBe(3);
    expect(petit.parties).toBe(3);
  });
});
