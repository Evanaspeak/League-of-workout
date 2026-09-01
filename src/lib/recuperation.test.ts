import { createHash } from "crypto";
import { PREFIXE_RESET, VALIDITE_MS, empreinte } from "./recuperation";

/**
 * La seule porte de secours du produit, et elle n'avait pas de test.
 *
 * Ce module tient trois promesses, toutes vérifiables : le jeton ne se stocke
 * jamais en clair, un lien ne vaut qu'une heure, et les identifiants de
 * récupération ne se mêlent pas à ceux d'Auth.js.
 */
describe("la récupération de compte", () => {
  it("ne stocke jamais le jeton, seulement son empreinte", () => {
    const jeton = "un-jeton-parfaitement-secret";
    const e = empreinte(jeton);
    expect(e).not.toContain(jeton);
    // SHA-256 en hexadécimal : soixante-quatre caractères, rien d'autre.
    expect(e).toMatch(/^[0-9a-f]{64}$/);
    expect(e).toBe(createHash("sha256").update(jeton).digest("hex"));
  });

  it("rend toujours la même empreinte pour le même jeton", () => {
    // Sans quoi un lien valide serait refusé : c'est la comparaison qui sert.
    expect(empreinte("abc")).toBe(empreinte("abc"));
  });

  it("distingue deux jetons voisins", () => {
    expect(empreinte("abc")).not.toBe(empreinte("abd"));
  });

  it("porte son préfixe, pour ne pas se mêler aux jetons d'Auth.js", () => {
    expect(PREFIXE_RESET).toBe("reset:");
    // Le préfixe doit se terminer par un séparateur : « reset » tout court
    // couvrirait « resetprofil » le jour où une autre sorte de jeton arrive.
    expect(PREFIXE_RESET.endsWith(":")).toBe(true);
  });

  it("vaut une heure, ni un jour ni une minute", () => {
    // Une heure : le temps de relever sa boîte. Une valeur beaucoup plus
    // longue laisserait un lien de reprise d'accès traîner dans une boîte
    // partagée ; beaucoup plus courte le rendrait inutilisable.
    expect(VALIDITE_MS).toBe(3_600_000);
  });
});
