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
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const middleware = readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");

/** Les préfixes publics, tels que le fichier les déclare. */
function prefixesPublics(): string[] {
  const bloc = middleware.match(/const PUBLIC_PREFIXES = \[([\s\S]*?)\];/);
  if (!bloc) throw new Error("PUBLIC_PREFIXES introuvable dans middleware.ts");
  return [...bloc[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** La règle du middleware, recopiée telle quelle. */
const estPublique = (chemin: string) =>
  chemin === "/" || prefixesPublics().some((p) => chemin.startsWith(p));

describe("source de diffusion", () => {
  it("laisse passer la page et la lecture par jeton", () => {
    expect(estPublique("/obs/" + "a".repeat(43))).toBe(true);
    expect(estPublique("/api/obs/" + "a".repeat(43))).toBe(true);
  });

  it("garde la création et la révocation du jeton derrière la session", () => {
    // C'est le point : un préfixe « /api/obs » sans barre finale ouvrirait
    // aussi cette adresse, et n'importe qui pourrait révoquer le lien d'un
    // autre ou s'en fabriquer un.
    expect(estPublique("/api/obs")).toBe(false);
  });

  it("n'ouvre rien d'autre par ricochet", () => {
    for (const chemin of ["/api/games", "/api/dette", "/api/settings", "/dashboard"]) {
      expect(estPublique(chemin)).toBe(false);
    }
  });
});
