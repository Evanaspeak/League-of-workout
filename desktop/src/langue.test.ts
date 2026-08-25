// `export {}` fait de ce fichier un module : sans lui, ses `const` de tête
// vivent dans la portée globale et se heurtent à celles des autres tests.
export {};

const { LANGUES, REPLI, choisirLangue } = require("./langue");

describe("le choix de la langue", () => {
  it("reconnaît une étiquette complète", () => {
    expect(choisirLangue("fr-FR")).toBe("fr");
    expect(choisirLangue("de-AT")).toBe("de");
    expect(choisirLangue("zh-Hans-CN")).toBe("zh");
    expect(choisirLangue("ja_JP")).toBe("ja");
  });

  it("prend le premier candidat qu'elle sait parler", () => {
    // L'ordre est celui de la confiance : ce que la personne a choisi passe
    // avant ce que le système suppose.
    expect(choisirLangue(null, "pt-BR", "de-DE")).toBe("de");
    expect(choisirLangue("es", "fr")).toBe("es");
  });

  it("retombe sur l'anglais, jamais sur le français ni sur du vide", () => {
    // Le français est la langue de celui qui écrit l'application : le prendre
    // pour défaut, c'est ne jamais voir le défaut.
    expect(choisirLangue()).toBe(REPLI);
    expect(choisirLangue("pt", "ru", "")).toBe(REPLI);
    expect(REPLI).toBe("en");
  });

  it("ne se laisse pas avoir par une valeur qui n'est pas du texte", () => {
    expect(choisirLangue(undefined, 42 as unknown as string, {} as unknown as string, "ja")).toBe("ja");
  });

  it("connaît exactement six langues", () => {
    expect(LANGUES).toEqual(["fr", "en", "es", "de", "zh", "ja"]);
  });
});
