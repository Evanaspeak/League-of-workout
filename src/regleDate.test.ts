/**
 * La forme d'une date ne dit pas qu'elle existe, et la règle vit à UN endroit.
 *
 * `/^\d{4}-\d{2}-\d{2}$/` accepte « 2026-02-30 » et « 9999-99-99 ». Le premier
 * GLISSE au 2 mars selon la plateforme ; le second n'est pas une date du tout.
 * `estJourValide` les refuse par un aller-retour, et c'est la correction déjà
 * faite deux fois — sur `/api/dashboard/daily`, qui tombait en 500, puis sur
 * `/api/progression`, qui rendait une série de zéro.
 *
 * Elle avait été écrite une troisième et une quatrième fois, à l'identique et
 * sans l'aller-retour : `/api/serie` comptait la série depuis un jour
 * inexistant, et `/api/dette` ÉCRIVAIT ce jour dans `Paiement.jour`, où il
 * serait resté pour toujours — un paiement posé sur une date qu'aucun
 * calendrier ne contient ne compte jamais dans la série.
 *
 * C'est le huitième cas de règle dupliquée trouvé sur ce projet, et il prend
 * toujours la même forme : ce n'est pas la copie qu'on remarque, c'est qu'une
 * correction n'en répare qu'une part.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const RACINE = join(__dirname, "..");

function sources(dossier: string, out: string[] = []): string[] {
  for (const f of readdirSync(dossier)) {
    if (f === "node_modules" || f === "generated" || f.startsWith(".")) continue;
    const p = join(dossier, f);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** Le motif de forme, écrit en toutes lettres. */
const MOTIF_NU = /\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//;

/**
 * Le seul fichier qui a le droit de l'écrire : c'est là que vit
 * `estJourValide`, qui l'emploie comme PREMIÈRE moitié du contrôle.
 */
const PORTEUR = join("src", "lib", "serie.ts");

describe("le contrôle de date", () => {
  const fichiers = sources(join(RACINE, "src"));

  it("regarde vraiment des fichiers", () => {
    expect(fichiers.length).toBeGreaterThan(100);
    // Et le porteur de la règle existe encore, sous ce nom.
    expect(fichiers.map((p) => relative(RACINE, p))).toContain(PORTEUR);
  });

  it("n'écrit le motif de forme qu'à un seul endroit", () => {
    const fautifs = fichiers
      .filter((p) => relative(RACINE, p) !== PORTEUR)
      .filter((p) => MOTIF_NU.test(readFileSync(p, "utf8")))
      .map((p) => relative(RACINE, p));
    expect(fautifs).toEqual([]);
  });

  it("et le porteur l'écrit bien", () => {
    // Sans ce contrôle, le motif pourrait disparaître PARTOUT — y compris là
    // où il doit être — et le test resterait vert en ne gardant plus rien.
    expect(MOTIF_NU.test(readFileSync(join(RACINE, PORTEUR), "utf8"))).toBe(true);
  });
});
