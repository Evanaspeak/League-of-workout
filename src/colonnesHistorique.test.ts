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
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const RACINE = join(__dirname, "..");
const ROUTE = join(RACINE, "src/app/api/games/route.ts");

/**
 * L'écran d'historique se CHERCHE, il ne se nomme pas.
 *
 * Il s'appelait `history/page.tsx` ; le jour où la page a été coupée en deux —
 * une coquille serveur qui sait si le compte est vide, et le composant client —
 * le fichier est devenu `Historique.tsx`, et ce garde s'est mis à lire un
 * chemin qui n'existait plus. Il est tombé, ce qui est le bon comportement,
 * grâce au témoin de non-vacuité. Mais c'est la troisième fois cette nuit
 * qu'un garde est accroché à un CHEMIN plutôt qu'à ce qu'il garde.
 *
 * Il cherche donc, dans le dossier de l'historique, le fichier qui DÉCLARE le
 * type `Game` : c'est lui l'écran, quel que soit son nom.
 */
const DOSSIER = join(RACINE, "src/app/[locale]/history");
const ECRAN = (() => {
  const candidats = readdirSync(DOSSIER)
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => join(DOSSIER, f))
    .filter((f) => /\ntype Game = \{/.test(readFileSync(f, "utf8")));
  if (candidats.length !== 1) {
    throw new Error(
      `Un seul fichier de ${DOSSIER} doit déclarer « type Game » ; ${candidats.length} trouvé(s). ` +
        "Si l'écran a été renommé ou découpé, c'est ici qu'on le retrouve.",
    );
  }
  return candidats[0];
})();

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
