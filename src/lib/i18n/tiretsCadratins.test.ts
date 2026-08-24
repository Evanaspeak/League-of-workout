import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pas de tiret cadratin au fil d'une phrase.
 *
 * C'est une consigne du propriétaire du produit, et elle a sa raison : le
 * tiret cadratin en incise est la ponctuation par laquelle un texte écrit par
 * une machine se reconnaît en un coup d'œil. Sur un produit dont la voix est
 * l'argument principal, ça se paie tout de suite.
 *
 * Elle ne vaut que pour ce que l'utilisateur lit. Les commentaires de code, ce
 * fichier compris, s'en servent librement : personne ne les lit dans
 * l'application.
 *
 * Deux usages restent permis, et ils ne sont pas des incises :
 * - le tiret **seul**, qui tient lieu de « pas de valeur » dans un tableau ou
 *   une carte de statistique. C'est une convention typographique, pas une
 *   phrase ;
 * - le tiret double chinois « —— », qui est un signe de ponctuation à part
 *   entière du chinois, avec ses propres règles. Le refuser reviendrait à
 *   imposer la typographie française à une langue qui a la sienne.
 */
const DOSSIER = join(__dirname, "dictionaries");

/** Les valeurs de chaîne d'un fichier de dictionnaire, ligne par ligne. */
function phrasesAvecCadratin(source: string): string[] {
  const trouvees: string[] = [];
  for (const ligne of source.split("\n")) {
    const nue = ligne.trim();
    // Commentaires : hors sujet, personne ne les lit dans l'application.
    if (nue.startsWith("//") || nue.startsWith("*") || nue.startsWith("/*")) continue;
    for (const m of ligne.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
      const texte = m[1];
      if (!texte.includes("—")) continue;
      // Le tiret seul : « pas de valeur ».
      if (texte.trim() === "—") continue;
      // Le tiret double chinois, qui n'est pas le tiret cadratin français.
      if (texte.replace(/——/g, "").includes("—") === false) continue;
      trouvees.push(texte.length > 90 ? `${texte.slice(0, 90)}…` : texte);
    }
  }
  return trouvees;
}

describe("les textes lus par l'utilisateur", () => {
  test("le recensement lit bien tous les dictionnaires", () => {
    // Sans ce contrôle, un chemin qui change rend une liste vide et le test
    // passe en ne regardant rien.
    const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(fichiers.length).toBeGreaterThan(30);
    expect(fichiers).toContain("dashboard.ts");
  });

  test("n'emploient pas le tiret cadratin en incise", () => {
    const fautifs: string[] = [];
    for (const fichier of readdirSync(DOSSIER)) {
      if (!fichier.endsWith(".ts") || fichier.endsWith(".test.ts")) continue;
      const source = readFileSync(join(DOSSIER, fichier), "utf8");
      for (const phrase of phrasesAvecCadratin(source)) {
        fautifs.push(`${fichier} : ${phrase}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
