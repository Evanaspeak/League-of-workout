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
  // Le mur des records ouvert ou fermé : même chose, c'est un réglage, et
  // l'écran des réglages doit pouvoir l'afficher et le changer.
  "recordsPublics",
  // Ce qu'un ami a le droit de voir : même chose, c'est un réglage.
  "partageAmis",
  // Le nom montré aux autres : même chose. Il sort du compte parce que
  // l'écran des réglages doit pouvoir l'afficher et le changer.
  "nomAffiche",
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
  formuleCalorique:
    "Quelle variante de Mifflin-St Jeor employer. Donnée de SANTÉ au sens de "
    + "l'article 9, comme le poids et la taille : elle n'a aucune raison de "
    + "traverser la réponse que la navigation lit à chaque page, et "
    + "`comptePublic` sert les routes de DIFFUSION — la source OBS s'affiche "
    + "devant le public de quelqu'un d'autre. Elle se demande par "
    + "`/api/settings`, derrière la porte.",
  niveauActivite:
    "Le multiplicateur d'activité du calcul calorique. Donnée de santé, même "
    + "raison que la variante de formule : derrière la porte, jamais en "
    + "diffusion, et présente à l'export de l'article 20.",
  modeCalorique:
    "Perte, maintien ou prise de masse. C'est le renseignement le plus "
    + "personnel du lot — il dit ce que quelqu'un cherche à faire de son "
    + "corps — et il n'a rien à faire dans une réponse lue par une source de "
    + "diffusion. Derrière la porte, avec le reste des réglages.",
  poidsCible:
    "Le poids visé (réponse 020). Donnée de santé, et de la même famille que "
    + "le mode : elle dit une intention sur son propre corps. Elle ne sort "
    + "que par les réglages et par l'export.",
  tourTaille:
    "Mesure au mètre-ruban pour l'estimation de masse grasse (réponse 023, "
    + "en option). Donnée de santé : jamais en diffusion, jamais dans la "
    + "réponse lue à chaque page.",
  tourCou:
    "Mesure au mètre-ruban, même famille et même raison que le tour de "
    + "taille : elle ne sert qu'à la formule US Navy, derrière la porte.",
  tourHanches:
    "Mesure au mètre-ruban, acceptée en réponse 024 parce que la variante "
    + "féminine de la formule ne peut pas s'en passer. Donnée de santé, "
    + "traitée exactement comme les deux autres.",
  rappelPeseeActif:
    "Le rappel de pesée hebdomadaire est-il allumé (réponse 022, optionnel). "
    + "Un réglage de notification qui dit qu'on suit son poids : c'est un "
    + "renseignement de santé sous une autre forme, et il reste derrière la "
    + "porte.",
  rappelPeseeLe:
    "Marque du dernier rappel de pesée envoyé, comme `rappelLe` et "
    + "`bilanLe`. Mécanique interne d'envoi : aucun écran ne la lit, et une "
    + "donnée qui voyage sans lecteur est du gaspillage avant d'être un "
    + "risque.",
  paiementEclairLe:
    "La première dette soldée dans l'heure. Elle sort bien, mais transformée : " +
    "`/api/progression` en rend un BOOLÉEN, qui est tout ce que l'écran " +
    "montre. La date elle-même n'a aucun lecteur, et une donnée qui voyage à " +
    "chaque chargement de page sans que personne ne la lise est du gaspillage " +
    "avant d'être un risque. Elle figure en revanche dans l'export de " +
    "l'article 20, qui couvre tout ce qu'on garde.",
  jetonProfil:
    "Lien du profil public : une adresse qui montre le pseudo et l'effort SANS " +
    "session, donc un laissez-passer, pas un réglage. Même raison que le jeton " +
    "de diffusion : il n'a rien à voyager à chaque chargement de page.",
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

describe("les défauts des réglages de confidentialité", () => {
  /**
   * Le défaut se lit dans le SCHÉMA, parce que c'est lui qui décide pour les
   * comptes qui n'ouvriront jamais leurs réglages — c'est-à-dire la plupart.
   * Un défaut basculé à « ouvert » ferait publier davantage des gens qui
   * n'ont rien demandé, et rien dans le code applicatif ne le dirait.
   */
  const bloc = SCHEMA.match(/^model User \{$([\s\S]*?)^\}$/m);
  if (!bloc) throw new Error("Le modèle User est introuvable dans le schéma.");
  const modele = bloc[1];

  it.each([
    ["fantome", "false"],
    ["recordsPublics", "false"],
  ])("%s vaut %s par défaut, c'est-à-dire le plus fermé", (colonne, defaut) => {
    const ligne = modele.split("\n").find((l) => new RegExp(`^\\s*${colonne}\\s`).test(l));
    expect(ligne).toBeDefined();
    expect(ligne).toContain(`@default(${defaut})`);
  });
});
