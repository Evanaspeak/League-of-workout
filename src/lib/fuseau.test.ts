import { estFuseauValide, heureLocale } from "./fuseau";

describe("validité d'un fuseau", () => {
  it("accepte des identifiants IANA réels", () => {
    for (const f of ["Europe/Paris", "UTC", "America/New_York", "Asia/Tokyo"]) {
      expect(estFuseauValide(f)).toBe(true);
    }
  });

  it("refuse le reste", () => {
    for (const rebut of [null, undefined, 42, "", "Europe/Neverland", "x".repeat(80)]) {
      expect(estFuseauValide(rebut)).toBe(false);
    }
  });
});

describe("heure locale", () => {
  // Un instant précis, choisi de nuit en Europe pour que l'écart se voie.
  const instant = new Date("2026-08-23T01:30:00Z");

  it("donne des heures différentes selon le fuseau", () => {
    expect(heureLocale(instant, "UTC")).toBe(1);
    expect(heureLocale(instant, "Europe/Paris")).toBe(3);   // UTC+2 en été
    expect(heureLocale(instant, "Asia/Tokyo")).toBe(10);    // UTC+9
    expect(heureLocale(instant, "America/New_York")).toBe(21); // veille, UTC-4
  });

  it("rend minuit comme zéro, jamais comme vingt-quatre", () => {
    // Certaines plateformes rendent « 24 » à minuit : un test d'égalité à
    // l'heure d'envoi ne verrait alors jamais passer minuit.
    expect(heureLocale(new Date("2026-08-23T00:15:00Z"), "UTC")).toBe(0);
  });

  it("rend nul sur un fuseau inconnu", () => {
    // « On ne sait pas » n'est pas « il est neuf heures » : les confondre
    // enverrait la notification au mauvais moment.
    expect(heureLocale(instant, "Europe/Neverland")).toBeNull();
    expect(heureLocale(instant, null)).toBeNull();
  });
});
