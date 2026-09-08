import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
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
  // Le poids de chaque exercice dans le partage : c'est un réglage, et
  // l'écran des réglages doit pouvoir l'afficher et le changer.
  "partsExercices",
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

/**
 * Et le compte ne sort JAMAIS autrement que par `comptePublic`.
 *
 * Le recensement des colonnes, plus haut, dit ce qui a le droit de sortir. Il
 * ne disait rien des routes qui ne passent pas par le filtre : `PUT /api/user`
 * rendait `prisma.user.update()` tel quel — **soixante champs mesurés**, dont
 * l'empreinte du mot de passe, le jeton de diffusion, le code de parrainage et
 * l'identifiant du parrain. Au navigateur de la personne, donc dans son cache,
 * dans son onglet réseau, et chez tout ce qui s'interpose.
 *
 * C'est exactement le défaut pour lequel `comptePublic` a été écrit, sur la
 * seule route qui ne l'employait pas — et le garde des colonnes ne pouvait pas
 * le voir : il éprouve la FONCTION, pas ses appelants. C'est le trou que ce
 * projet paie en boucle.
 */
describe("le compte ne sort que par le filtre", () => {
  const API = join(process.cwd(), "src", "app", "api");

  /**
   * Aucune dispense, et ce n'est pas un oubli.
   *
   * Le panneau d'administration lit les autres comptes — c'est tout son objet
   * — et il pourrait sembler mériter une exemption. Il n'en a pas besoin, pour
   * une raison qu'il vaut mieux dire exactement : **il ne publie pas la
   * variable**, il rend `{ users: result }`, une liste qu'il a recomposée. Le
   * motif ne l'a donc jamais désigné.
   *
   * Le tri sur `select` juste en dessous ne le sauve donc PAS aujourd'hui —
   * vérifié par sabotage, le retirer ne rend personne fautif. Il est gardé
   * pour le cas qui viendra : une route qui publie directement une ligne
   * SÉLECTIONNÉE, où quelqu'un a déjà décidé de ce qui sort. Comme il n'a
   * aucun cas réel, il s'éprouve sur des cas FABRIQUÉS, juste après.
   */
  const DISPENSES: Record<string, string> = {};

  /** Le tri qui distingue une ligne BRUTE d'une projection choisie. */
  const estBrut = (appel: string) => !/\bselect\s*:|\bomit\s*:/.test(appel);

  function routes(dossier: string, out: string[] = []): string[] {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const c = join(dossier, e.name);
      if (e.isDirectory()) routes(c, out);
      else if (/^route\.tsx?$/.test(e.name)) out.push(c);
    }
    return out;
  }

  it("aucune route ne publie une ligne de compte telle qu'elle vient", () => {
    const fautives: string[] = [];
    let lectures = 0;

    for (const f of routes(API)) {
      const rel = relative(API, f).split("\\").join("/");
      if (DISPENSES[rel]) continue;
      const texte = readFileSync(f, "utf8");
      // Les noms qui reçoivent une ligne de compte.
      const noms = new Set<string>();
      for (const m of texte.matchAll(
        /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+prisma\.user\.(?:update|create|upsert|findUnique|findFirst|findMany)/g,
      )) {
        lectures += 1;
        /**
         * Une requête qui porte un `select` ou un `omit` ne rend PAS une
         * ligne : elle rend une projection choisie, donc quelqu'un a décidé
         * de ce qui sort. C'est le cas du panneau d'administration, et c'est
         * pourquoi il n'a pas besoin d'exemption.
         */
        const appel = texte.slice(m.index, m.index + 900);
        if (!estBrut(appel)) continue;
        noms.add(m[1]);
      }
      for (const nom of noms) {
        const publie = new RegExp(
          String.raw`NextResponse\.json\(\s*(?:\{\s*\.\.\.\s*)?${nom}\b`,
        );
        if (publie.test(texte)) fautives.push(`${rel} : publie ${nom} sans comptePublic`);
      }
    }

    expect(fautives).toEqual([]);
    // Sans ce témoin, un motif devenu aveugle rendrait le contrôle vert en
    // n'ayant reconnu aucune lecture de compte.
    expect(lectures).toBeGreaterThanOrEqual(5);
  });

  it("distingue une ligne brute d'une projection choisie", () => {
    // Éprouvé sur des cas fabriqués : le dépôt n'en contient aucun où le tri
    // change quelque chose, donc les fichiers réels ne le distinguent pas
    // d'un tri cassé.
    expect(estBrut("const u = await prisma.user.update({ where: { id }, data });")).toBe(true);
    expect(estBrut("const u = await prisma.user.update({ where: { id }, data, select: { pseudo: true } });")).toBe(false);
    expect(estBrut("const u = await prisma.user.findUnique({ where: { id }, omit: { passwordHash: true } });")).toBe(false);
  });

  it("chaque dispense, s'il en revient une, désigne une route qui existe", () => {
    for (const rel of Object.keys(DISPENSES)) {
      expect(existsSync(join(API, rel))).toBe(true);
    }
  });
});
