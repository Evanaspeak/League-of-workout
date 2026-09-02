import {
  ecartEnJours, estJourValide, etatRetard, JOURS_AVANT_RETARD, jourPrecedent,
  longueurSerie, meilleureSerie,
} from "./serie";

describe("étiquettes de calendrier", () => {
  it("recule d'un jour, y compris au changement de mois et d'année", () => {
    expect(jourPrecedent("2026-08-23")).toBe("2026-08-22");
    expect(jourPrecedent("2026-08-01")).toBe("2026-07-31");
    expect(jourPrecedent("2026-01-01")).toBe("2025-12-31");
    expect(jourPrecedent("2028-03-01")).toBe("2028-02-29");
  });

  it("ne perd pas un jour au passage à l'heure d'été", () => {
    // La nuit du 29 mars 2026 ne dure que vingt-trois heures en Europe. Un
    // calcul en heures y perdrait un jour, et casserait une série intacte.
    expect(jourPrecedent("2026-03-30")).toBe("2026-03-29");
    expect(ecartEnJours("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("série en cours", () => {
  it("compte les jours consécutifs jusqu'à aujourd'hui", () => {
    const jours = ["2026-08-21", "2026-08-22", "2026-08-23"];
    expect(longueurSerie(jours, "2026-08-23")).toBe(3);
  });

  it("tient encore si le paiement du jour n'est pas fait", () => {
    // Une série ne doit pas paraître cassée à neuf heures du matin : elle ne
    // casse qu'au saut d'un jour entier.
    expect(longueurSerie(["2026-08-21", "2026-08-22"], "2026-08-23")).toBe(2);
  });

  it("casse dès qu'un jour manque", () => {
    expect(longueurSerie(["2026-08-19", "2026-08-20"], "2026-08-23")).toBe(0);
  });

  it("ne compte pas deux fois deux paiements du même jour", () => {
    const jours = ["2026-08-23", "2026-08-23", "2026-08-22"];
    expect(longueurSerie(jours, "2026-08-23")).toBe(2);
  });

  it("ne rend rien sans aucun paiement", () => {
    expect(longueurSerie([], "2026-08-23")).toBe(0);
  });
});

describe("meilleure série", () => {
  it("retient la plus longue suite, même ancienne", () => {
    const jours = [
      "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04",
      "2026-08-22", "2026-08-23",
    ];
    expect(meilleureSerie(jours)).toBe(4);
  });

  it("compte un jour isolé comme une série de un", () => {
    expect(meilleureSerie(["2026-08-23"])).toBe(1);
  });

  it("ne rend rien sur une liste vide", () => {
    expect(meilleureSerie([])).toBe(0);
  });
});

describe("retard", () => {
  const T = (jours: number) => new Date(Date.now() - jours * 86_400_000);

  it("ne dit rien tant que la dette est récente", () => {
    expect(etatRetard(T(1), 40).enRetard).toBe(false);
  });

  it("le dit au bout de trois jours", () => {
    const r = etatRetard(T(JOURS_AVANT_RETARD), 40);
    expect(r.enRetard).toBe(true);
    expect(r.jours).toBe(JOURS_AVANT_RETARD);
  });

  it("ne dit rien quand il n'y a plus rien à payer", () => {
    // Une date de début qui traîne après un paiement ne doit pas maintenir un
    // état de retard sur une dette éteinte.
    expect(etatRetard(T(10), 0).enRetard).toBe(false);
  });

  it("ne dit rien sans date de début", () => {
    expect(etatRetard(null, 40).enRetard).toBe(false);
  });

  it("ne rend pas un retard négatif sur une horloge décalée", () => {
    const futur = new Date(Date.now() + 86_400_000);
    expect(etatRetard(futur, 40).jours).toBe(0);
  });
});

/**
 * La forme d'une date ne dit pas qu'elle existe.
 *
 * La règle vivait dans `/api/dashboard/daily`, où son absence avait fait
 * tomber la route en 500 sur « 9999-99-99 » et montrer le 2 mars pour un
 * « 2026-02-30 » demandé. `/api/progression` s'en tenait au motif, et laissait
 * donc passer la même chaîne — elle rendait une série de zéro en
 * court-circuitant le repli prévu pour ce cas exact.
 */
describe("estJourValide", () => {
  it("accepte un vrai jour", () => {
    expect(estJourValide("2026-09-02")).toBe(true);
    expect(estJourValide("2024-02-29")).toBe(true); // année bissextile
  });

  it("refuse ce qui a la forme sans être une date", () => {
    expect(estJourValide("9999-99-99")).toBe(false);
    expect(estJourValide("2026-13-01")).toBe(false);
    expect(estJourValide("2026-00-10")).toBe(false);
  });

  /**
   * Le cas qui échappe à un simple « est-ce que Date l'accepte » : selon la
   * plateforme, `Date` fait GLISSER le 30 février au 2 mars au lieu de le
   * refuser. C'est l'aller-retour qui l'attrape.
   */
  it("refuse un jour qui n'existe pas dans son mois", () => {
    expect(estJourValide("2026-02-30")).toBe(false);
    expect(estJourValide("2025-02-29")).toBe(false); // année non bissextile
    expect(estJourValide("2026-04-31")).toBe(false);
  });

  it("refuse ce qui n'a pas la forme", () => {
    expect(estJourValide("2026-9-2")).toBe(false);
    expect(estJourValide("02/09/2026")).toBe(false);
    expect(estJourValide("")).toBe(false);
    expect(estJourValide(null)).toBe(false);
    expect(estJourValide(undefined)).toBe(false);
  });
});
