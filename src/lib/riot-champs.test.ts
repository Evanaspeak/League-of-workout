import { routageDe, validerPuuid, validerRiotId, nettoyerRiotId } from "./riot-champs";

/**
 * Ces tests gardent l'injection d'URL sur l'API Riot.
 *
 * Le PUUID partait brut dans l'adresse appelée avec la clé du serveur. Un dièse
 * déplaçait le suffixe codé en dur dans le fragment — jamais transmis — ce qui
 * laissait choisir chemin et requête. L'hôte, lui, tenait grâce à la table de
 * routage fermée : ce fichier vérifie que les deux verrous restent en place.
 */
describe("validerPuuid", () => {
  it.each([
    ["PU/ids?api_key=x#", "le dièse s'appropriait le chemin et la requête"],
    ["AAA/../../../lol/status/v4/platform-data", "traversée de chemin"],
    ["PU/ids?start=0", "requête ajoutée"],
    ["a\r\nX-Evil: 1", "retours chariot"],
    ["PU#frag", "fragment seul"],
    ["", "vide"],
  ])("refuse %s (%s)", (charge) => {
    expect(validerPuuid(charge)).toBeNull();
  });

  it("refuse ce qui n'est pas une chaîne", () => {
    for (const nul of [null, undefined, 42, {}, []]) expect(validerPuuid(nul)).toBeNull();
  });

  it("accepte un PUUID Riot ordinaire", () => {
    const vrai = "aBc_De-0123456789".repeat(4).slice(0, 78);
    expect(validerPuuid(vrai)).toBe(vrai);
  });
});

describe("routageDe", () => {
  it("route les plateformes connues", () => {
    expect(routageDe("EUW1")).toBe("europe");
    expect(routageDe("NA1")).toBe("americas");
    expect(routageDe("KR")).toBe("asia");
  });

  it("retombe sur l'Europe plutôt que de laisser choisir l'hôte", () => {
    for (const hostile of ["__proto__", "constructor", "toString", "evil.com",
                           "../../x", null, undefined, 42]) {
      expect(routageDe(hostile)).toBe("europe");
    }
  });
});

describe("validerRiotId", () => {
  it("accepte pseudo#tag", () => {
    expect(validerRiotId("Evan#EUW")).toBe("Evan#EUW");
    expect(validerRiotId("  Zed 42#1234  ")).toBe("Zed 42#1234");
  });

  it("retire les caractères de direction que glisse le client League", () => {
    expect(nettoyerRiotId("⁦Evan⁩#EUW")).toBe("Evan#EUW");
  });

  it("refuse ce qui n'a pas la forme attendue", () => {
    for (const mauvais of ["Evan", "#EUW", "Evan#", "Evan#E", "Evan#TROPLONG9",
                           "a#b#c", "Evan#EU W", "", null, 42,
                           "x".repeat(40) + "#EUW"]) {
      expect(validerRiotId(mauvais)).toBeNull();
    }
  });
});
