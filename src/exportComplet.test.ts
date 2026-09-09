import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Tout ce qui est RATTACHÉ à un compte se retrouve dans son export.
 *
 * Le garde de `api/user/export/route.test.ts` vérifie que chaque bloc PRÉSENT
 * dans le fichier est annoncé par la phrase de l'écran, ou porte la raison
 * pour laquelle il ne l'est pas. C'est une bonne règle et elle a un angle mort
 * exact : **elle ne voit pas un modèle que l'export n'a jamais lu.** Un bloc
 * absent n'est pas un bloc mal annoncé, c'est un bloc invisible.
 *
 * C'est ainsi que les PESÉES sont restées hors de l'export depuis le jour où
 * elles existent — la donnée la plus sensible que l'application garde, de la
 * santé au sens de l'article 9, et saisie à la main, donc « fournie par la
 * personne » au sens le plus littéral de l'article 20. Rien ne le signalait :
 * le fichier était complet de tout ce qu'il contenait.
 *
 * Ce contrôle-ci part du SCHÉMA et non du fichier. Toute relation déclarée sur
 * `User` doit être lue par l'export, ou figurer ci-dessous avec sa raison.
 */

const RACINE = join(__dirname, "..");
const schema = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
const route = readFileSync(join(RACINE, "src/app/api/user/export/route.ts"), "utf8");

/**
 * Ce qu'un export ne rend pas, et pourquoi.
 *
 * Deux raisons seulement, et aucune n'est « on a jugé que ça n'intéresse
 * personne » — c'est précisément le raisonnement qui a laissé les pesées
 * dehors.
 */
const HORS_EXPORT: Record<string, string> = {
  /**
   * Ce qui NOMME quelqu'un d'autre.
   *
   * Une amitié sans l'ami n'est pas une donnée : l'autre bout de la relation
   * est l'identité d'une deuxième personne, qui n'a pas demandé à figurer dans
   * un fichier qu'on s'envoie par courriel. C'est la même frontière que celle
   * du profil d'un ami, où le filtre est en base plutôt qu'à l'affichage.
   */
  amitiesEnvoyees: "nomme quelqu'un d'autre",
  amitiesRecues: "nomme quelqu'un d'autre",
  groupes: "nomme quelqu'un d'autre",
  filleuls: "nomme quelqu'un d'autre",
  /**
   * Ce qui EST un laissez-passer.
   *
   * `Account` porte les jetons OAuth, `Session` les identifiants de session.
   * Les mettre dans un fichier qui circule par courriel serait une clé laissée
   * sur la table — c'est la raison qui tient déjà `jetonObs` hors de ce que le
   * compte publie.
   */
  accounts: "un jeton d'accès, pas une donnée personnelle",
  sessions: "un identifiant de session, pas une donnée personnelle",
};

/**
 * Les COLONNES du compte que l'export ne rend pas, et pourquoi.
 *
 * C'est l'autre moitié du même angle mort, et elle a coûté seize réglages.
 * Le contrôle des relations attrape une TABLE que l'export n'a jamais lue ;
 * il ne dit rien d'une colonne scalaire, et c'est là que dormaient toute la
 * rubrique « Ton corps », les quatre réglages de confidentialité et la
 * conduite de session — tous TAPÉS par la personne, donc « fournis par elle »
 * au sens le plus littéral de l'article 20.
 *
 * Le sens de l'erreur décide de la forme : une colonne AJOUTÉE au schéma sans
 * être classée fait tomber ce test, plutôt que de sortir en silence ou de
 * rester en silence. La même règle que pour `compte.test.ts`, sur la troisième
 * question qu'on peut poser à une colonne — non plus « sort-elle du compte »,
 * mais « la personne peut-elle la reprendre ».
 */
const COLONNES_HORS_EXPORT: Record<string, string> = {
  // ── Ce qui EST un laissez-passer ────────────────────────────────────────
  passwordHash:
    "L'empreinte du mot de passe. Un fichier de portabilité circule par "
    + "courriel : y mettre de quoi rejouer une authentification serait une clé "
    + "laissée sur la table.",
  jetonObs:
    "Le jeton de la source de diffusion : une adresse publique qui montre la "
    + "dette en direct. C'est un laissez-passer, et la seule façon de le "
    + "révoquer est de le refaire.",
  jetonProfil:
    "Le jeton du profil public, même nature et même raison que celui de la "
    + "diffusion : il ouvre une page sans session.",
  codeParrain:
    "Le code d'invitation : quiconque l'a peut créer un compte rattaché à "
    + "celui-ci. Il se lit sur l'écran des amis, où il est fait pour être "
    + "partagé volontairement.",
  sessionEpoch:
    "Le compteur qui invalide les sessions ouvertes. Mécanique interne "
    + "d'authentification : aucun écran ne la lit, et elle ne dit rien de la "
    + "personne.",

  // ── Ce qui NOMME quelqu'un d'autre ──────────────────────────────────────
  parrainId:
    "L'identifiant de qui l'a fait venir. C'est un renseignement sur une "
    + "DEUXIÈME personne, qui n'a pas demandé à figurer dans un fichier qu'on "
    + "s'envoie — la même frontière que celle des amitiés.",

  // ── Mécanique d'envoi, sans lecteur ─────────────────────────────────────
  bilanLe: "Marque du dernier bilan hebdomadaire envoyé : mécanique d'envoi.",
  rappelLe: "Marque du dernier rappel du matin envoyé : mécanique d'envoi.",
  relanceLe: "Marque de la dernière relance d'absence : mécanique d'envoi.",
  rappelPeseeLe: "Marque du dernier rappel de pesée : mécanique d'envoi.",
  emailVerified:
    "Marque de vérification d'adresse posée par Auth.js. Mécanique "
    + "d'authentification, pas une donnée que la personne a fournie.",
  introGeneration:
    "Compteur qui fait rejouer la visite guidée. État d'interface, remis à "
    + "zéro depuis l'administration ; il ne dit rien de la personne.",

  // ── Dérivé de ce qui est DÉJÀ exporté ───────────────────────────────────
  riotPuuid:
    "L'identifiant opaque que Riot attribue au compte. Il se déduit du Riot "
    + "ID, qui est exporté juste à côté, et il n'a de sens que pour l'API de "
    + "Riot — il n'apprend rien de plus à qui lit son fichier.",

  // ── Colonnes MORTES, déclarées telles au schéma ─────────────────────────
  exercice:
    "L'ancienne colonne au singulier, remplacée par `exercices` et annotée "
    + "« ne plus l'utiliser » au schéma. L'exporter donnerait un réglage qui "
    + "ne gouverne plus rien.",
  rappelSeuilPoints:
    "L'ancien seuil de rappel en POINTS, remplacé par `rappelSeuilSec` et "
    + "conservé le temps de la transition. Même raison : un chiffre qui ne "
    + "décide plus de rien.",
};

/**
 * Les colonnes SCALAIRES de `User` — tout ce qui n'est pas une relation.
 *
 * Le tri se fait sur le type : un nom de modèle connu, avec ou sans `[]`,
 * désigne une relation, dont le contrôle des blocs s'occupe déjà.
 */
function colonnesDuCompte(): string[] {
  const bloc = schema.match(/model User \{([\s\S]*?)\n\}/);
  if (!bloc) throw new Error("le modèle User est introuvable dans le schéma");
  const modeles = new Set(
    [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]),
  );
  return [...bloc[1].matchAll(/^ {2}(\w+)\s+(\w+)(\[\])?/gm)]
    .filter((m) => !modeles.has(m[2]))
    .map((m) => m[1]);
}

describe("l'export rend chaque colonne du compte, ou dit pourquoi il ne la rend pas", () => {
  const colonnes = colonnesDuCompte();

  it("lit bien le schéma", () => {
    // Sans ce témoin, un modèle renommé rendrait le contrôle vert sur zéro
    // colonne lue, c'est-à-dire sur rien.
    expect(colonnes.length).toBeGreaterThan(40);
    expect(colonnes).toContain("passwordHash");
    expect(colonnes).toContain("dettePointsDus");
  });

  it("n'oublie aucune colonne", () => {
    const oubliees = colonnes.filter(
      (c) => !new RegExp(`user\\.${c}\\b`).test(route) && !(c in COLONNES_HORS_EXPORT),
    );
    expect(oubliees).toEqual([]);
  });

  it("refuse une dispense qui ne désigne plus rien", () => {
    const connues = new Set(colonnes);
    const mortes = Object.keys(COLONNES_HORS_EXPORT).filter((c) => !connues.has(c));
    expect(mortes).toEqual([]);
  });

  it("chaque dispense porte sa raison", () => {
    for (const [colonne, raison] of Object.entries(COLONNES_HORS_EXPORT)) {
      expect(raison.length).toBeGreaterThan(40);
      expect(colonne).not.toBe("");
    }
  });
});

/**
 * Les relations `Modele[]` déclarées sur `User`.
 *
 * Sa LIMITE est écrite plutôt que laissée à découvrir : le rapprochement se
 * fait sur le NOM DU DÉLÉGUÉ Prisma, donc deux relations vers le même modèle
 * sont indistinguables. `paiements` et `relaisRecus` pointent tous deux vers
 * `Paiement` : lire l'un satisferait le contrôle pour les deux. C'est
 * pourquoi les deux sont exportés plutôt qu'un seul dispensé — une dispense
 * que le garde ne saurait pas vérifier se relit comme une garantie.
 */
function relationsDuCompte(): { champ: string; modele: string }[] {
  const bloc = /model User \{([\s\S]*?)\n\}/.exec(schema);
  if (!bloc) throw new Error("modèle User introuvable — le garde ne garde plus rien");
  const rels: { champ: string; modele: string }[] = [];
  for (const m of bloc[1].matchAll(/^ {2}(\w+)\s+(\w+)\[\]/gm)) {
    // Les tableaux de types primitifs ne sont pas des relations : ce sont des
    // colonnes, déjà tenues par `compte.test.ts` et par la politique.
    if (/^(String|Int|Float|Boolean|DateTime|Json|Bytes|Decimal|BigInt)$/.test(m[2])) continue;
    rels.push({ champ: m[1], modele: m[2] });
  }
  return rels;
}

describe("l'export de données", () => {
  const relations = relationsDuCompte();

  it("lit chaque chose rattachée au compte, ou dit pourquoi il ne la lit pas", () => {
    // Sans témoin, un modèle renommé rendrait le contrôle vert sur zéro
    // relation — l'angle mort qu'il existe pour fermer.
    expect(relations.length).toBeGreaterThan(10);

    const oublies = relations.filter(({ champ, modele }) => {
      if (champ in HORS_EXPORT) return false;
      const delegue = modele[0].toLowerCase() + modele.slice(1);
      return !route.includes(`prisma.${delegue}.`);
    });
    expect(oublies).toEqual([]);
  });

  it("refuse une dispense qui ne désigne plus rien", () => {
    const champs = new Set(relations.map((r) => r.champ));
    expect(Object.keys(HORS_EXPORT).filter((c) => !champs.has(c))).toEqual([]);
  });

  /**
   * Le témoin du DÉCOUPAGE, distinct du précédent.
   *
   * Un motif qui rendrait le fichier ENTIER au lieu du seul bloc `User`
   * trouverait toutes les relations du schéma, donc bien plus que les siennes,
   * et le contrôle passerait pour la mauvaise raison : il chercherait des
   * modèles que l'export lit de toute façon. `Game` a ses propres relations,
   * et aucune n'appartient au compte.
   */
  it("ne lit que le bloc User", () => {
    expect(relations.some((r) => r.modele === "Game")).toBe(true);
    expect(relations.some((r) => r.modele === "User")).toBe(true);
    expect(relations.length).toBeLessThan(30);
  });
});
