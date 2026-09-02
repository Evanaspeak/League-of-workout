/**
 * La fenêtre d'envoi, et pourquoi elle a remplacé une heure exacte.
 *
 * `heureLocale(...) === 9` supposait un déclencheur ponctuel. Il ne l'est pas :
 * trente exécutions en huit jours au lieu de cent quatre-vingt-douze, et aucune
 * à l'heure qu'il fallait. Ce fichier tient les deux moitiés de la correction —
 * la fenêtre, et la marque qui empêche d'envoyer trois fois dans la matinée.
 */
import {
  DEBUT_MATIN, FIN_MATIN, dansLaFenetreDuMatin, dejaEnvoyeAujourdhui,
} from "@/lib/fenetreEnvoi";

/** Le jour local, simplifié : ce que `jourDansFuseau` rend en vrai. */
const jourDe = (d: Date) => d.toISOString().slice(0, 10);

describe("dansLaFenetreDuMatin", () => {
  it("accepte les trois heures de la fenêtre", () => {
    for (const h of [9, 10, 11]) expect(dansLaFenetreDuMatin(h)).toBe(true);
  });

  it("refuse avant et après", () => {
    for (const h of [0, 3, 8, 12, 13, 20, 23]) expect(dansLaFenetreDuMatin(h)).toBe(false);
  });

  /**
   * Un fuseau qu'on ne sait pas lire rend `null`, et `null` n'est pas neuf
   * heures. C'est la règle qui empêche d'écrire « bonjour » à trois heures du
   * matin, et elle vaut toujours.
   */
  it("refuse une heure inconnue", () => {
    expect(dansLaFenetreDuMatin(null)).toBe(false);
  });

  it("garde une fenêtre qui est bien le matin", () => {
    expect(DEBUT_MATIN).toBe(9);
    expect(FIN_MATIN).toBeLessThanOrEqual(12);
    expect(FIN_MATIN).toBeGreaterThan(DEBUT_MATIN);
  });
});

describe("dejaEnvoyeAujourdhui", () => {
  const matin = new Date("2026-09-02T09:15:00Z");

  it("laisse passer quand rien n'est jamais parti", () => {
    expect(dejaEnvoyeAujourdhui(null, matin, jourDe)).toBe(false);
    expect(dejaEnvoyeAujourdhui(undefined, matin, jourDe)).toBe(false);
  });

  it("retient un envoi du même jour", () => {
    expect(dejaEnvoyeAujourdhui(new Date("2026-09-02T09:12:00Z"), matin, jourDe)).toBe(true);
  });

  it("laisse repartir le lendemain", () => {
    expect(dejaEnvoyeAujourdhui(new Date("2026-09-01T11:59:00Z"), matin, jourDe)).toBe(false);
  });

  /**
   * Le cas qui a décidé de la forme : une comparaison en HEURES ÉCOULÉES ferait
   * dériver la marque. Envoyé à 11 h 30, un « au moins vingt-quatre heures »
   * interdirait l'envoi de 9 h le lendemain, puis celui du surlendemain
   * remonterait encore — l'envoi sauterait un jour sur deux. Le jour local, lui,
   * ne dérive pas.
   */
  it("ne dérive pas d'un jour à l'autre", () => {
    const hier1130 = new Date("2026-09-01T11:30:00Z");
    const aujourdhui0900 = new Date("2026-09-02T09:00:00Z");
    // Moins de vingt-quatre heures se sont écoulées, et pourtant c'est un
    // autre jour : l'envoi doit partir.
    expect(aujourdhui0900.getTime() - hier1130.getTime()).toBeLessThan(24 * 3600_000);
    expect(dejaEnvoyeAujourdhui(hier1130, aujourdhui0900, jourDe)).toBe(false);
  });
});
