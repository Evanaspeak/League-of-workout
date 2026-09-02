import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Une seule durée, celle qu'on montre.
 *
 * La même dette était convertie en secondes à quatre endroits : la pastille
 * dans le navigateur, le seuil d'alerte au serveur, la notification envoyée à
 * l'enregistrement d'une partie, et celle du rappel du matin. Les quatre ont
 * fini par diverger — la pastille passait en alerte à 3 min 35 sous un seuil
 * de 5 min, et une notification annonçait 8 min 06 que rien à l'écran ne
 * montrait.
 *
 * `dureeAffichee` est la seule bonne réponse partout où un nombre est MONTRÉ
 * ou comparé à un seuil : c'est la somme des quantités telles qu'on les écrit,
 * arrondies au pas de chaque exercice.
 *
 * `dureeEffort` reste juste — et reste nécessaire — là où l'on calcule une
 * PROPORTION : l'arrondi n'a rien à faire dans un rapport, et le paiement
 * partiel de `/api/dette` en dépend. Chaque emploi restant porte donc sa
 * raison, écrite ici.
 */
const SRC = join(__dirname);

/**
 * Les fichiers qui ont le droit d'appeler `dureeEffort`, avec leur raison.
 *
 * Une exemption sans raison écrite finit par toutes les couvrir.
 */
const PROPORTION: Record<string, string> = {
  "app/api/dette/route.ts":
    "calcule la part payée d'une séance interrompue : un rapport, pas un affichage",
  "lib/exercices.ts":
    "définit les deux fonctions",
};

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      if (entree === "generated") continue;
      trouves.push(...fichiers(complet));
    } else if (/\.tsx?$/.test(entree) && !/\.test\.tsx?$/.test(entree)) {
      trouves.push(complet);
    }
  }
  return trouves;
}

/** Les appels, sans les lignes de commentaire qui citent le nom pour l'expliquer. */
function appelle(source: string, nom: string): boolean {
  return source
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .some((l) => new RegExp(`\\b${nom}\\(`).test(l));
}

describe("la durée d'effort", () => {
  const tous = fichiers(SRC).map((f) => ({
    chemin: f.slice(SRC.length + 1),
    source: readFileSync(f, "utf8"),
  }));

  /**
   * Sans ce contrôle, un dossier renommé rendrait le test vert en n'examinant
   * aucun fichier — la forme d'erreur que `gardesNonVides` surveille.
   */
  it("examine vraiment des fichiers", () => {
    expect(tous.length).toBeGreaterThan(100);
    expect(tous.some((f) => appelle(f.source, "dureeAffichee"))).toBe(true);
  });

  it("ne se calcule à l'exact que là où c'est une proportion", () => {
    const fautifs = tous
      .filter((f) => appelle(f.source, "dureeEffort"))
      .map((f) => f.chemin)
      .filter((c) => !(c in PROPORTION));
    expect({ fautifs }).toEqual({ fautifs: [] });
  });

  it("n'exempte que des fichiers qui appellent encore", () => {
    // Une exemption qui ne désigne plus rien de vivant est du code mort qu'on
    // a fini par admettre.
    const fantomes = Object.keys(PROPORTION).filter(
      (c) => !tous.some((f) => f.chemin === c && appelle(f.source, "dureeEffort")),
    );
    expect({ fantomes }).toEqual({ fantomes: [] });
  });
});
