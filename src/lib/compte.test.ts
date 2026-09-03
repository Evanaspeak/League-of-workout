import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comptePublic } from "./compte";

/**
 * Le recensement qui accompagne la liste de refus.
 *
 * `comptePublic` retire des colonnes nommées : ce qui n'y figure pas part au
 * navigateur. C'est tenable tant que quelqu'un décide pour chaque colonne
 * ajoutée — et personne ne décide, parce que rien ne le demande. `jetonObs`
 * est arrivé ainsi : un laissez-passer qui partait à chaque chargement de page
 * sans que personne ne l'ait voulu, pendant des semaines, sans qu'aucun test
 * ne bouge.
 *
 * Le test lit donc le schéma plutôt que la liste. Une colonne nouvelle doit
 * être rangée d'un côté ou de l'autre, et celles qui ne sortent pas portent
 * leur raison. C'est le motif de `porteRoutes.test.ts`, appliqué aux colonnes.
 */

const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

function champsScalairesDeUser(): string[] {
  const bloc = SCHEMA.match(/^model User \{$([\s\S]*?)^\}$/m);
  if (!bloc) throw new Error("Le modèle User est introuvable dans le schéma.");

  // Les relations portent un type qui commence par une majuscule et qui n'est
  // pas un scalaire Prisma : ce sont elles qu'on écarte, pas les colonnes.
  const SCALAIRES = new Set([
    "String", "Int", "Float", "Boolean", "DateTime", "Json", "BigInt", "Decimal", "Bytes",
  ]);
  const champs: string[] = [];
  for (const ligne of bloc[1].split("\n")) {
    const m = ligne.match(/^\s{2}(\w+)\s+(\w+)(\[\])?\??/);
    if (!m) continue;
    if (!SCALAIRES.has(m[2])) continue;
    champs.push(m[1]);
  }
  return champs;
}

/**
 * Ce qui part au navigateur. Rien de secret : le compte, ses réglages, ce
 * qu'on affiche dans « Ton effort » et dans l'en-tête.
 */
const PART_AU_NAVIGATEUR = new Set([
  "id", "email", "emailVerified", "name", "image",
  "pseudo", "riotId", "riotPuuid", "riotRegion", "gainageMaxSec",
  "introGeneration",
  "genre", "age", "poids", "taille", "sportsHoursPerWeek",
  "santeConsentiLe", "santeRefuseLe",
  "detteDepuis", "dettePointsDus",
  // Le mode fantôme est un réglage : l'écran des réglages le lit et l'écrit.
  "fantome",
  // Ce qu'un ami a le droit de voir : même chose, c'est un réglage.
  "partageAmis",
  "exercicesSuspendus", "suspensionDepuis",
  "langue", "bilanActif", "bilanLe", "relanceLe", "rappelLe", "fuseau",
  "variantePompes", "exercice", "exercices",
  "rappelSeuilPoints", "rappelSeuilSec", "plafondQuotidien",
  // La conduite au démarrage d'un jeu : la page en a besoin pour savoir s'il
  // faut poser la question, la lancer seule, ou ne rien faire.
  "sessionAuto",
  "pompesMax", "pompesMaxLe",
  "betaRank", "createdAt",
]);

/** Ce qui ne sort jamais, et pourquoi. */
const NE_SORT_PAS: Record<string, string> = {
  passwordHash:
    "Condensat du mot de passe : la seule chose qui protège le compte.",
  jetonObs:
    "Laissez-passer sans session vers la dette en direct. Il se demande par /api/obs.",
  codeParrain:
    "Le code de parrainage n'est pas secret, il est fait pour être partagé — " +
    "mais il n'a rien à voyager à chaque chargement de page. Un seul écran le " +
    "consomme, et /api/parrainage le lui donne.",
  parrainId:
    "Qui m'a invité est un renseignement sur quelqu'un d'AUTRE. Le publier " +
    "dans la réponse que la navigation lit à chaque page dirait, à qui regarde " +
    "l'onglet réseau, par quel compte celui-ci est arrivé.",
  sessionEpoch:
    "Compteur de révocation des sessions. Il ne dit rien d'utile à l'écran et " +
    "renseigne un attaquant sur la fraîcheur des jetons qu'il détiendrait.",
};

describe("comptePublic", () => {
  const champs = champsScalairesDeUser();

  it("lit bien le schéma", () => {
    // Sans ce garde, un modèle renommé rendrait toute la suite verte sur zéro
    // colonne lue, c'est-à-dire sur rien.
    expect(champs.length).toBeGreaterThan(30);
    expect(champs).toContain("passwordHash");
    expect(champs).toContain("dettePointsDus");
  });

  it("range chaque colonne du compte d'un côté ou de l'autre", () => {
    const orphelines = champs.filter(
      (c) => !PART_AU_NAVIGATEUR.has(c) && !(c in NE_SORT_PAS),
    );
    expect(orphelines).toEqual([]);
  });

  it("ne garde aucune classification qui ne désigne plus rien", () => {
    const connues = new Set(champs);
    const mortes = [...PART_AU_NAVIGATEUR, ...Object.keys(NE_SORT_PAS)].filter(
      (c) => !connues.has(c),
    );
    expect(mortes).toEqual([]);
  });

  it("chaque refus porte sa raison", () => {
    for (const [champ, raison] of Object.entries(NE_SORT_PAS)) {
      expect(raison.length).toBeGreaterThan(30);
      expect(champ).not.toBe("");
    }
  });

  it("retire effectivement tout ce qui ne doit pas sortir", () => {
    // Un compte complet, comme la base le rend : chaque colonne porte son
    // propre nom en valeur, pour qu'un oubli se lise dans le message d'échec.
    const compte = Object.fromEntries(champs.map((c) => [c, c])) as Record<string, unknown>;
    const rendu = comptePublic(compte) as Record<string, unknown>;

    for (const secret of Object.keys(NE_SORT_PAS)) {
      expect(rendu).not.toHaveProperty(secret);
    }
    for (const champ of PART_AU_NAVIGATEUR) {
      expect(rendu[champ]).toBe(champ);
    }
  });

  it("ne modifie pas l'objet qu'on lui donne", () => {
    const compte = { id: "u1", passwordHash: "x", jetonObs: "y" };
    comptePublic(compte);
    expect(compte.passwordHash).toBe("x");
    expect(compte.jetonObs).toBe("y");
  });
});
