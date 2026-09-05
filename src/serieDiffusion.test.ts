/**
 * La série de la source de diffusion, composée là où la langue est connue.
 *
 * C'est la seule surface du produit que des inconnus regardent : elle
 * s'affiche par-dessus un stream, devant le public de quelqu'un d'autre. Le
 * composant écrivait `{serie} {textes.jours}`, et le JSX pose une espace
 * entre deux expressions — « 3 日 » et « 3 天 » là où le japonais et le
 * chinois écrivent « 3日 » et « 3天 ».
 *
 * Le dictionnaire ne peut pas porter la règle : il traverse le réseau en
 * JSON, où une fonction ne survit pas. C'est la route qui compose.
 */
import { serieDiffusion } from "@/lib/i18n/diffusion";

describe("la série de la source de diffusion", () => {
  it("colle le compteur au nombre là où la langue le veut", () => {
    expect(serieDiffusion(3, "ja")).toBe("3日");
    expect(serieDiffusion(3, "zh")).toBe("3天");
  });

  it("et le sépare là où la langue le veut aussi", () => {
    expect(serieDiffusion(3, "fr")).toBe("3 j");
    expect(serieDiffusion(3, "en")).toBe("3 d");
    expect(serieDiffusion(3, "es")).toBe("3 d");
    expect(serieDiffusion(3, "de")).toBe("3 T");
  });

  it("groupe le nombre selon la langue", () => {
    // Mille jours font presque trois ans. Le séparateur ne coûte rien, et le
    // jour où il servira personne ne relira ce fichier.
    // L'espace de groupement du français est une insécable ÉTROITE (U+202F) :
    // écrite à l'œil, l'assertion compare deux chaînes qui se ressemblent et
    // ne sont pas les mêmes.
    expect(serieDiffusion(1200, "fr")).toBe("1\u202f200 j");
    expect(serieDiffusion(1200, "de")).toBe("1.200 T");
    expect(serieDiffusion(1200, "ja")).toBe("1,200日");
  });

  it("retombe sur l'anglais pour une langue inconnue, jamais sur du vide", () => {
    // La page de diffusion n'a pas de langue dans son adresse : elle prend
    // celle du COMPTE, et un compte sans langue connue doit rester lisible.
    expect(serieDiffusion(3, undefined)).toBe("3 d");
    expect(serieDiffusion(3, "pt")).toBe("3 d");
  });

  it("les six langues rendent bien six textes, pas un seul", () => {
    // Témoin : sans lui, un repli qui avalerait tout passerait au vert.
    const rendus = new Set(["fr", "en", "es", "de", "zh", "ja"].map((l) => serieDiffusion(3, l)));
    expect(rendus.size).toBeGreaterThanOrEqual(4);
  });
});
