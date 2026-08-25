import { refusRiot } from "./riotStatut";

/**
 * Un sens par code.
 *
 * Les trois routes Riot renvoyaient le code de Riot tel quel. Le 401 changeait
 * donc de sens en chemin : dans toute l'application il veut dire « pas de
 * session », et là il pouvait aussi vouloir dire « Riot a refusé notre clé ».
 * Le journal annonçait « clé refusée, rien à faire de ton côté » à quelqu'un
 * qui n'avait qu'à se reconnecter.
 */
describe("refusRiot", () => {
  it("range une clé refusée en 403, jamais en 401", () => {
    for (const code of [401, 403]) {
      const r = refusRiot(code, "introuvable");
      expect(r.statut).toBe(403);
      expect(r.message).toContain("clé");
    }
  });

  it("dit ce qui est introuvable avec les mots de la route", () => {
    // Une partie absente et un joueur inconnu ne se corrigent pas pareil :
    // c'est l'appelant qui sait lequel des deux il cherchait.
    expect(refusRiot(404, "Joueur introuvable.")).toEqual({
      statut: 404, message: "Joueur introuvable.",
    });
  });

  it("laisse passer la limitation, qui se traite en attendant", () => {
    expect(refusRiot(429, "x").statut).toBe(429);
  });

  it("range tout le reste en 502, du côté de chez eux", () => {
    // 500 laisserait croire que la panne est la nôtre.
    for (const code of [500, 502, 503, 418]) {
      expect(refusRiot(code, "x").statut).toBe(502);
    }
  });

  it("ne rend jamais un message vide", () => {
    for (const code of [401, 403, 404, 429, 500, 418]) {
      expect(refusRiot(code, "introuvable").message.length).toBeGreaterThan(10);
    }
  });
});
