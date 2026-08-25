import { estCheminPublic, PREFIXES_PUBLICS } from "./routesPubliques";

/**
 * La comparaison par segments, et la convention du préfixe terminé par `/`.
 *
 * `startsWith("/api")` accepte `/apiculture`. Rien de tel n'existe
 * aujourd'hui : c'est ce qui rend la faute invisible, et c'est aussi ce qui la
 * rend dangereuse — elle ne dépend que du nom qu'on donnera à la prochaine
 * route. Le même défaut gardait une frontière d'origine dans l'application de
 * bureau, où il était exploitable.
 */
describe("estCheminPublic", () => {
  it("laisse passer la racine et les pages publiques", () => {
    for (const chemin of ["/", "/login", "/beta", "/cgu", "/calculateur"]) {
      expect(estCheminPublic(chemin)).toBe(true);
    }
  });

  it("laisse passer les enfants d'un préfixe public", () => {
    expect(estCheminPublic("/calculateur/league-of-legends")).toBe(true);
    expect(estCheminPublic("/recuperation/valider")).toBe(true);
    expect(estCheminPublic("/obs/un-jeton-quelconque")).toBe(true);
  });

  it("protège tout le reste", () => {
    for (const chemin of ["/dashboard", "/settings", "/history", "/api/games", "/api/user"]) {
      expect(estCheminPublic(chemin)).toBe(false);
    }
  });

  it("compare par segments, pas par lettres", () => {
    // Aucune de ces adresses n'existe. C'est le propos : une comparaison qui
    // les accepte accepte aussi celle qu'on créera demain sans y penser.
    expect(estCheminPublic("/betamachin")).toBe(false);
    expect(estCheminPublic("/loginsecret")).toBe(false);
    expect(estCheminPublic("/api/santeprivee")).toBe(false);
    expect(estCheminPublic("/obsolete")).toBe(false);
  });

  it("réserve `/api/obs` à qui a une session, et ouvre ses enfants", () => {
    // Cette route-là rend et régénère le jeton de diffusion : l'ouvrir
    // donnerait le laissez-passer à qui passe devant.
    expect(estCheminPublic("/api/obs")).toBe(false);
    expect(estCheminPublic("/api/obs/un-jeton")).toBe(true);
  });

  it("nomme l'inscription à la bêta en entier", () => {
    // `/api/beta` couvrait aussi tout ce qui commencerait par ces lettres :
    // une coïncidence de nommage, pas une décision.
    expect(estCheminPublic("/api/beta-access")).toBe(true);
    expect(estCheminPublic("/api/beta-autre-chose")).toBe(false);
  });

  it("ne porte aucun préfixe vide", () => {
    // Une chaîne vide rendrait tout public, et le reste des tests continuerait
    // de passer.
    expect(PREFIXES_PUBLICS.every((p) => p.length > 1)).toBe(true);
  });
});
