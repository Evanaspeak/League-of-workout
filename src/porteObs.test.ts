/**
 * La frontière entre les deux routes « obs ».
 *
 * `/api/obs/<jeton>` est PUBLIQUE : un logiciel de diffusion n'a ni cookie ni
 * session, et l'adresse est le laissez-passer.
 *
 * `/api/obs` sans jeton CRÉE et RÉVOQUE ce laissez-passer. Si le préfixe
 * public s'écrivait « /api/obs » au lieu de « /api/obs/ », n'importe qui
 * pourrait fabriquer un lien public vers un compte qui n'est pas le sien, ou
 * révoquer celui d'un autre. Un caractère sépare les deux, et rien ne le
 * rappelle en lisant le fichier.
 *
 * Ce test lisait `middleware.ts` au texte et portait, écrit en toutes lettres,
 * « la règle du middleware, recopiée telle quelle ». C'était le troisième
 * exemplaire de la même comparaison — avec la règle elle-même et avec
 * `porteRoutes.test.ts`. Le jour où la vraie règle a changé, la copie est
 * restée juste sur une chose qui n'existait plus. Il importe maintenant ce qui
 * tourne.
 */
import { estCheminPublic } from "@/lib/routesPubliques";

describe("source de diffusion", () => {
  it("laisse passer la page et la lecture par jeton", () => {
    expect(estCheminPublic("/obs/" + "a".repeat(43))).toBe(true);
    expect(estCheminPublic("/api/obs/" + "a".repeat(43))).toBe(true);
  });

  it("garde la création et la révocation du jeton derrière la session", () => {
    // C'est le point : un préfixe « /api/obs » sans barre finale ouvrirait
    // aussi cette adresse, et n'importe qui pourrait révoquer le lien d'un
    // autre ou s'en fabriquer un.
    expect(estCheminPublic("/api/obs")).toBe(false);
  });

  it("n'ouvre rien d'autre par ricochet", () => {
    for (const chemin of ["/api/games", "/api/dette", "/api/settings", "/dashboard"]) {
      expect(estCheminPublic(chemin)).toBe(false);
    }
  });
});
