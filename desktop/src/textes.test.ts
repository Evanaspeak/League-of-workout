// Ce que les dictionnaires du site subissent déjà : mêmes clés partout, aucune
// valeur vide, aucune clé morte. Un texte de la coquille Electron n'a pas de
// raison d'y échapper — c'est même le seul endroit où personne ne le verrait,
// puisque ces écrans ne s'ouvrent qu'en cas de pépin.

// `export {}` fait de ce fichier un module : sans lui, ses `const` de tête
// vivent dans la portée globale et se heurtent à celles des autres tests.
export {};

const fs = require("node:fs");
const path = require("node:path");
const { TEXTES, textes } = require("./textes");
const { LANGUES } = require("./langue");

type Dico = Record<string, string>;
const dicos = TEXTES as Record<string, Dico>;

describe("les textes de l'application de bureau", () => {
  it("existent dans les six langues, et seulement dans celles-là", () => {
    expect(Object.keys(dicos).sort()).toEqual([...LANGUES].sort());
  });

  it("portent exactement les mêmes clés d'une langue à l'autre", () => {
    const reference = Object.keys(dicos.fr).sort();
    expect(reference.length).toBeGreaterThan(15);
    for (const langue of LANGUES) {
      expect({ langue, cles: Object.keys(dicos[langue]).sort() })
        .toEqual({ langue, cles: reference });
    }
  });

  it("ne rendent jamais du vide", () => {
    for (const langue of LANGUES) {
      for (const [cle, valeur] of Object.entries(dicos[langue])) {
        expect({ langue, cle, vide: String(valeur).trim() === "" })
          .toEqual({ langue, cle, vide: false });
      }
    }
  });

  it("n'emploient pas de tiret cadratin en incise", () => {
    // Consigne du produit : c'est la ponctuation par laquelle un texte écrit
    // par une machine se reconnaît. Le tiret double chinois « —— » est un
    // signe à part entière et reste permis ; il n'apparaît pas ici.
    for (const langue of LANGUES) {
      for (const [cle, valeur] of Object.entries(dicos[langue])) {
        const fautif = /—/.test(String(valeur)) && !/——/.test(String(valeur));
        expect({ langue, cle, fautif }).toEqual({ langue, cle, fautif: false });
      }
    }
  });

  it("déclare tout ce que les sources lui demandent", () => {
    // Le contrôle qui manquait, et son histoire : une restauration maladroite a
    // effacé les dix clés de la pastille, et TOUTE la suite est restée verte.
    // Le test d'à-côté refuse une clé déclarée que personne n'emploie ; il ne
    // dit rien d'une clé employée que personne ne déclare. Or c'est celle-là
    // qui se voit — « undefined » écrit en travers de la pastille, pendant une
    // partie.
    const dossier = __dirname;
    const fichiers = fs.readdirSync(dossier)
      .filter((f: string) => (f.endsWith(".js") || f.endsWith(".html")) && !f.includes("textes"));
    expect(fichiers.length).toBeGreaterThan(5);

    const demandees = new Set<string>();
    for (const f of fichiers) {
      const source = fs.readFileSync(path.join(dossier, f), "utf8");
      for (const m of source.matchAll(/\bT\.([A-Za-z][A-Za-z0-9]*)/g)) demandees.add(m[1]);
      for (const m of source.matchAll(/data-texte="([^"]+)"/g)) demandees.add(m[1]);
      for (const m of source.matchAll(/textes\([^)]*\)\.([A-Za-z][A-Za-z0-9]*)/g)) demandees.add(m[1]);
    }
    // Sans ce contrôle, un motif qui ne trouve plus rien rendrait le test vert.
    expect(demandees.size).toBeGreaterThan(15);

    const connues = new Set(Object.keys(dicos.fr));
    expect([...demandees].filter((c) => !connues.has(c)).sort()).toEqual([]);
  });

  it("retombe sur l'anglais pour une langue qu'on ne parle pas", () => {
    expect(textes("pt")).toBe(dicos.en);
    expect(textes(undefined)).toBe(dicos.en);
  });

  it("n'a aucune clé que personne n'emploie", () => {
    // Le piège des dictionnaires : une clé survit à l'écran qui la lisait, et
    // se fait traduire cinq fois de plus avant qu'on s'en aperçoive.
    const dossier = __dirname;
    const sources = fs.readdirSync(dossier)
      // Le HTML de la pastille compte : c'est lui qui porte les clés
      // `data-texte`, et l'oublier faisait passer huit clés vivantes pour
      // mortes.
      .filter((f: string) => f.endsWith(".js") || f.endsWith(".html"))
      .map((f: string) => fs.readFileSync(path.join(dossier, f), "utf8"))
      .join("\n");
    // Sans ce contrôle, un dossier vide rendrait le test vert sur zéro lecture.
    expect(sources.length).toBeGreaterThan(1000);

    const mortes = Object.keys(dicos.fr).filter((cle) => {
      const motif = new RegExp(`\\.${cle}\\b|\\b${cle}\\s*:|"${cle}"`, "g");
      // La déclaration elle-même compte pour six (une par langue) : au-delà,
      // c'est qu'on la lit quelque part.
      return (sources.match(motif) ?? []).length <= LANGUES.length;
    });
    expect(mortes).toEqual([]);
  });
});
