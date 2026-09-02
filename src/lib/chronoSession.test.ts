import { CHRONO_OUBLI_MS, chronoARestaurer, pointsDuChrono, resteAPayer } from "./chronoSession";

const MAINTENANT = Date.UTC(2026, 8, 2, 3, 0, 0);
const sauvegarde = (o: Record<string, unknown>) => JSON.stringify(o);

/**
 * Une session au temps qui survit à un rechargement de page.
 *
 * Sans elle, deux heures de Minecraft disparaissent sur un F5 malheureux. Avec
 * elle mal réglée, c'est la soirée d'avant-hier qu'on se met à payer.
 */
describe("le chrono à reprendre", () => {
  it("reprend une session commencée il y a une heure", () => {
    const brut = sauvegarde({ jeu: "Minecraft", debut: MAINTENANT - 3_600_000, niveau: 3 });
    expect(chronoARestaurer(brut, MAINTENANT)).toEqual({
      jeu: "Minecraft", debut: MAINTENANT - 3_600_000, niveau: 3,
    });
  });

  it("ne reprend rien quand il n'y a rien", () => {
    expect(chronoARestaurer(null, MAINTENANT)).toBeNull();
    expect(chronoARestaurer("", MAINTENANT)).toBeNull();
  });

  it("ne reprend rien d'illisible", () => {
    // Le stockage du navigateur n'est pas un format : n'importe qui peut y
    // écrire, et une version antérieure y a peut-être écrit autre chose.
    for (const brut of ["{", "null", '"une chaîne"', "[]", "42"]) {
      // Le motif est repris dans le message par le nom de la variable.
      expect([brut, chronoARestaurer(brut, MAINTENANT)]).toEqual([brut, null]);
    }
  });

  it("refuse une sauvegarde sans date de début", () => {
    expect(chronoARestaurer(sauvegarde({ jeu: "Minecraft", niveau: 2 }), MAINTENANT)).toBeNull();
    // `Number(null)` vaut zéro, ce qui donnerait un chrono commencé en 1970.
    expect(chronoARestaurer(sauvegarde({ jeu: "M", debut: null }), MAINTENANT)).toBeNull();
    expect(chronoARestaurer(sauvegarde({ jeu: "M", debut: "hier" }), MAINTENANT)).toBeNull();
  });

  it("refuse une sauvegarde sans jeu", () => {
    expect(chronoARestaurer(sauvegarde({ debut: MAINTENANT - 1000 }), MAINTENANT)).toBeNull();
    expect(chronoARestaurer(sauvegarde({ jeu: "", debut: MAINTENANT - 1000 }), MAINTENANT)).toBeNull();
  });

  it("oublie un chrono de plus de douze heures", () => {
    const juste = sauvegarde({ jeu: "M", debut: MAINTENANT - CHRONO_OUBLI_MS + 1000 });
    const trop = sauvegarde({ jeu: "M", debut: MAINTENANT - CHRONO_OUBLI_MS - 1000 });
    expect(chronoARestaurer(juste, MAINTENANT)).not.toBeNull();
    expect(chronoARestaurer(trop, MAINTENANT)).toBeNull();
  });

  it("refuse un chrono commencé dans le futur", () => {
    // Une horloge changée entre deux ouvertures : le reprendre donnerait une
    // durée négative, donc une dette négative.
    const futur = sauvegarde({ jeu: "M", debut: MAINTENANT + 60_000 });
    expect(chronoARestaurer(futur, MAINTENANT)).toBeNull();
  });

  it("retombe sur le niveau zéro plutôt que de refuser", () => {
    // Le niveau ne change que le multiplicateur : l'absence ne justifie pas de
    // perdre la session, contrairement à la date ou au jeu.
    const brut = sauvegarde({ jeu: "M", debut: MAINTENANT - 1000, niveau: "trois" });
    expect(chronoARestaurer(brut, MAINTENANT)?.niveau).toBe(0);
  });
});

describe("ce que le temps coûte", () => {
  it("compte au prorata de l'heure", () => {
    expect(pointsDuChrono(MAINTENANT - 3_600_000, 60, MAINTENANT)).toBe(60);
    expect(pointsDuChrono(MAINTENANT - 1_800_000, 60, MAINTENANT)).toBe(30);
    expect(pointsDuChrono(MAINTENANT - 600_000, 60, MAINTENANT)).toBe(10);
  });

  it("ne compte rien sans chrono", () => {
    expect(pointsDuChrono(null, 60, MAINTENANT)).toBe(0);
  });

  it("ne crée pas de crédit quand l'horloge recule", () => {
    // Un changement d'heure, ou un fuseau qui bascule : une durée négative
    // deviendrait une dette négative, c'est-à-dire un cadeau.
    expect(pointsDuChrono(MAINTENANT + 60_000, 60, MAINTENANT)).toBe(0);
  });

  it("rend un entier, jamais une virgule", () => {
    // « 12,4 pompes » n'existe pas.
    expect(Number.isInteger(pointsDuChrono(MAINTENANT - 745_000, 37, MAINTENANT))).toBe(true);
  });
});

describe("ce qui reste à faire", () => {
  it("retire ce qui a déjà été porté au compteur", () => {
    expect(resteAPayer(50, 20)).toBe(20 + 10);
  });

  it("ne descend jamais sous zéro", () => {
    // On a fait plus que ce qu'on devait : c'est un cas légitime, pas une
    // erreur, et il ne doit pas rendre une dette négative.
    expect(resteAPayer(20, 50)).toBe(0);
  });
});
