/**
 * Ce que la route envoie et ce que l'écran lit doivent être la même liste.
 *
 * `GET /api/games` ne rend plus la partie entière mais un `select` nommé
 * colonne par colonne. C'est la bonne façon de faire — un `NextResponse.json`
 * posé sur une ligne de base publie tout ce qu'on lui remet, et c'est le
 * défaut déjà corrigé sur le compte par `comptePublic`.
 *
 * Le prix, c'est que la frontière n'est plus tenue par le compilateur :
 * l'historique déclare son propre type `Game`, la réponse arrive en JSON, et
 * une colonne retirée du `select` s'y traduit par une case vide. Pas d'erreur,
 * pas de test rouge, juste une colonne qui ne s'affiche plus — et le KDA d'une
 * partie ne se recalcule pas de mémoire.
 *
 * Les deux listes sont donc lues à la source et comparées. Dans les deux sens :
 * une colonne envoyée que personne ne lit est le gaspillage qu'on vient de
 * retirer, et elle reviendrait sans bruit.
 */
import { readFileSync } from "fs";
import { join } from "path";

const RACINE = join(__dirname, "..");
const ROUTE = join(RACINE, "src/app/api/games/route.ts");
const ECRAN = join(RACINE, "src/app/[locale]/history/page.tsx");

/** Les clés du `select` de la requête de liste. */
function colonnesEnvoyees(): string[] {
  const source = readFileSync(ROUTE, "utf8");
  // Le `select` de la seule requête de LISTE : celle qui rend directement sa
  // réponse. Les autres requêtes du fichier lisent pour écrire.
  const bloc = source.match(/orderBy:\s*\{\s*date:\s*"desc"\s*\},[\s\S]*?select:\s*\{([\s\S]*?)\n\s*\},/);
  if (!bloc) return [];
  return [...bloc[1].matchAll(/(\w+):\s*true/g)].map((m) => m[1]);
}

/** Les champs du type `Game` déclaré par l'écran d'historique. */
function colonnesLues(): string[] {
  const source = readFileSync(ECRAN, "utf8");
  const bloc = source.match(/\ntype Game = \{([\s\S]*?)\n\};/);
  if (!bloc) return [];
  // On retire les commentaires avant de lire les champs : un nom cité dans
  // une explication n'est pas un champ.
  const corps = bloc[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return [...corps.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
}

describe("les colonnes de l'historique", () => {
  const envoyees = colonnesEnvoyees();
  const lues = colonnesLues();

  // Sans ces deux contrôles, un motif qui ne trouve plus rien rendrait le
  // test vert en ne comparant que deux listes vides — la forme d'erreur
  // exacte que ce fichier existe pour empêcher.
  it("lit vraiment les deux listes", () => {
    expect(envoyees.length).toBeGreaterThan(15);
    expect(lues.length).toBeGreaterThan(15);
  });

  it("envoie tout ce que l'écran déclare lire", () => {
    const manquantes = lues.filter((c) => !envoyees.includes(c));
    expect(manquantes).toEqual([]);
  });

  it("n'envoie rien que l'écran ne lise", () => {
    const inutiles = envoyees.filter((c) => !lues.includes(c));
    expect(inutiles).toEqual([]);
  });
});
