// Le domaine qui suffixe le nôtre est le seul cas qui compte ici : c'est celui
// que la comparaison par préfixe laissait passer.

const { memeOrigine, cheminDe, dansLaSection } = require("./origine");

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
