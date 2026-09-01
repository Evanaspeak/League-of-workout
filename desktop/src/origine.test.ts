// Le domaine qui suffixe le nôtre est le seul cas qui compte ici : c'est celui
// que la comparaison par préfixe laissait passer.

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const { memeOrigine, cheminDe, dansLaSection, sansLangue, LANGUES } = require("./origine");

const NOUS = "https://winorworkout.com";

describe("la même origine", () => {
  it("accepte nos propres pages", () => {
    expect(memeOrigine(`${NOUS}/dashboard`, NOUS)).toBe(true);
    expect(memeOrigine(`${NOUS}/`, NOUS)).toBe(true);
    expect(memeOrigine(NOUS, NOUS)).toBe(true);
  });

  it("refuse un domaine qui suffixe le nôtre", () => {
    // Le défaut d'origine, en une ligne : la comparaison par préfixe rendait
    // vrai sur les deux.
    expect(memeOrigine("https://winorworkout.com.exemple-mechant.tld/", NOUS)).toBe(false);
    expect(memeOrigine("https://winorworkout.com-exemple.tld/x", NOUS)).toBe(false);
  });

  it("refuse un sous-domaine, un autre port et un autre protocole", () => {
    expect(memeOrigine("https://faux.winorworkout.com/", NOUS)).toBe(false);
    expect(memeOrigine("https://winorworkout.com:8443/", NOUS)).toBe(false);
    expect(memeOrigine("http://winorworkout.com/", NOUS)).toBe(false);
  });

  it("refuse ce qui n'est pas une adresse comparable", () => {
    expect(memeOrigine("about:blank", NOUS)).toBe(false);
    expect(memeOrigine("javascript:alert(1)", NOUS)).toBe(false);
    expect(memeOrigine("data:text/html,x", NOUS)).toBe(false);
    expect(memeOrigine("", NOUS)).toBe(false);
    expect(memeOrigine(null, NOUS)).toBe(false);
  });

  it("compare bien deux origines égales écrites différemment", () => {
    expect(memeOrigine(`${NOUS}:443/dashboard`, NOUS)).toBe(true);
  });
});

describe("le chemin", () => {
  it("écarte la requête et le fragment", () => {
    expect(cheminDe(`${NOUS}/login?next=/dashboard#a`)).toBe("/login");
  });

  it("rend vide sur une adresse illisible", () => {
    expect(cheminDe("pas une adresse")).toBe("");
  });
});

describe("la section", () => {
  it("reconnaît la section et ce qu'elle contient", () => {
    expect(dansLaSection("/api", "/api")).toBe(true);
    expect(dansLaSection("/api/games", "/api")).toBe(true);
  });

  it("ne confond pas avec un chemin qui commence pareil", () => {
    // `startsWith("/api")` acceptait « /apiculture ».
    expect(dansLaSection("/apiculture", "/api")).toBe(false);
    expect(dansLaSection("/loginsuite", "/login")).toBe(false);
  });
});

describe("le garde structurel", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  /**
   * Le module ne sert à rien si un sixième endroit recompare par préfixe. Le
   * test regarde le dossier plutôt que les cinq appels connus : c'est l'appel
   * qu'on écrira demain qui compte.
   */
  it("plus aucune comparaison d'adresse par préfixe", () => {
    const dossier = path.join(__dirname);
    const fichiers = fs.readdirSync(dossier)
      .filter((f: string) => f.endsWith(".js"));
    // Sans ce contrôle, un dossier renommé rendrait le test vert sur zéro
    // fichier lu.
    expect(fichiers.length).toBeGreaterThan(5);

    const fautifs: string[] = [];
    for (const f of fichiers) {
      const texte = fs.readFileSync(path.join(dossier, f), "utf8");
      for (const ligne of texte.split("\n")) {
        // Les commentaires décrivent le défaut : ils ne sont pas le défaut.
        if (/^\s*(\/\/|\*|\/\*)/.test(ligne)) continue;
        if (/startsWith\(\s*BACKEND_URL/.test(ligne)) fautifs.push(`${f} : ${ligne.trim()}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});

/**
 * Le préfixe de langue, retiré avant toute comparaison de chemin.
 *
 * Le site sert « /fr/login » depuis que la langue vit dans l'adresse. Le
 * contrôle qui décide « la connexion est finie » demande « ce n'est plus
 * /login ? » : sans ce retrait, il répondait oui à la toute première page,
 * refermait la fenêtre d'authentification avant qu'on ait tapé quoi que ce
 * soit, et cherchait un cookie qui n'existait pas encore.
 */
describe("sansLangue", () => {
  it("retire le préfixe quand il y en a un", () => {
    expect(sansLangue("/fr/login")).toBe("/login");
    expect(sansLangue("/ja/dashboard")).toBe("/dashboard");
    expect(sansLangue("/de")).toBe("/");
  });

  it("laisse tranquille un chemin qui n'en porte pas", () => {
    expect(sansLangue("/login")).toBe("/login");
    expect(sansLangue("/api/auth/callback/google")).toBe("/api/auth/callback/google");
    expect(sansLangue("/")).toBe("/");
  });

  it("compare par segments, pas par lettres", () => {
    // « from » commence par « fr », « design » par « de » : les rogner
    // enverrait la fenêtre sur une page qui n'existe pas.
    expect(sansLangue("/from/login")).toBe("/from/login");
    expect(sansLangue("/design")).toBe("/design");
  });

  it("porte les mêmes langues que le site", () => {
    /**
     * La liste est recopiée, et c'est assumé : la coquille Electron est
     * construite à part, sans le paquet du site, et rien ne peut lui passer
     * une constante. Ce contrôle existe pour que la divergence se voie le jour
     * où une septième langue s'ajoute — c'est le seul moyen, ici, de tenir une
     * règle écrite deux fois.
     */
    const source = readFileSync(
      join(__dirname, "..", "..", "src", "lib", "i18n", "langues.ts"), "utf8",
    );
    const bloc = source.match(/export const LANGUES: Locale\[\] = \[([^\]]+)\]/);
    expect(bloc).not.toBeNull();
    const duSite = [...bloc![1].matchAll(/"([a-z]{2})"/g)].map((m) => m[1]);
    expect(duSite.length).toBeGreaterThan(1);
    expect([...LANGUES].sort()).toEqual([...duSite].sort());
  });
});
