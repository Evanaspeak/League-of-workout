/**
 * La politique de confidentialité doit décrire ce que la base contient.
 *
 * Elle affirmait « aucune donnée de santé au sens médical n'est collectée »
 * alors que l'inscription demandait genre, âge, poids et taille, et que
 * l'application les croisait avec de l'activité physique. Rien ne l'a signalé
 * pendant des semaines : un document juridique ne se compile pas.
 *
 * Ce test lit le schéma Prisma et exige que chaque champ personnel du compte
 * soit soit décrit dans la politique, soit inscrit ci-dessous avec la raison
 * de son absence. Un champ ajouté demain casse la suite tant que l'un ou
 * l'autre n'est pas fait.
 */
import fs from "node:fs";
import path from "node:path";
import { confidentialite } from "./dictionaries/confidentialite";

/**
 * Champs qui n'ont pas à figurer dans la politique, et pourquoi.
 *
 * Un champ n'est exempté que s'il ne dit rien sur la personne : un identifiant
 * technique, un compteur interne, un réglage d'affichage.
 */
const HORS_POLITIQUE: Record<string, string> = {
  id: "identifiant technique",
  emailVerified: "horodatage d'un contrôle, pas une donnée fournie",
  sessionEpoch: "compteur interne de révocation des sessions",
  introGeneration: "compteur interne de réaffichage de l'intro",
  createdAt: "horodatage de création du compte",
  betaRank: "rang d'inscription, dérivé de la date",
  exercice: "réglage d'affichage (ancienne version)",
  exercices: "réglage : exercices choisis pour payer",
  rappelSeuilPoints: "réglage de rappel (ancienne version)",
  rappelSeuilSec: "réglage de rappel",
  plafondQuotidien: "réglage d'avertissement de volume",
  dettePointsDus: "état de jeu calculé, décrit par « données de parties »",
  gainageMaxSec: "mesure de force, décrite par « nombre maximum de pompes »",
  pompesMaxLe: "date du test de force, décrite avec lui",
  riotRegion: "région du compte Riot, décrite avec le Riot ID",
  name: "décrit par « nom d'affichage »",
  pseudo: "décrit par « nom d'affichage »",
  riotPuuid: "décrit avec le Riot ID",
  games: "relation", Goal: "relation", pushSubs: "relation",
  accounts: "relation", sessions: "relation",
};

/** Les mots à chercher dans la politique pour chaque champ qui doit y être. */
const ATTENDU: Record<string, RegExp> = {
  email: /adresse email/i,
  image: /photo de profil/i,
  passwordHash: /mot de passe/i,
  riotId: /riot id/i,
  genre: /genre/i,
  age: /âge/i,
  poids: /poids/i,
  taille: /taille/i,
  sportsHoursPerWeek: /heures de sport/i,
  pompesMax: /nombre maximum de pompes/i,
  // Une seule ligne du tableau décrit les deux dates : c'est la même réponse,
  // acceptée ou refusée, et l'article 7.1 impose de pouvoir la prouver.
  santeConsentiLe: /réponse au consentement santé/i,
  santeRefuseLe: /réponse au consentement santé/i,
  // Une relation, mais qui pointe sur des données que la personne nous a
  // données : le message et son contexte. Elle se décrit donc, elle ne
  // s'exempte pas.
  signalements: /signalement de problème/i,
  paiements: /paiements de dette/i,
  // Date de début de la dette courante : elle sert au retard, et elle se
  // décrit avec l'historique des paiements plutôt que séparément.
  detteDepuis: /paiements de dette/i,
};

/** Les champs du modèle User, lus dans le schéma. */
function champsDuCompte(): string[] {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const bloc = schema.match(/^model User \{([\s\S]*?)^\}/m);
  if (!bloc) throw new Error("modèle User introuvable dans le schéma");
  return bloc[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => (
      l !== ""
      // Les trois formes de commentaire que Prisma accepte, plus le corps d'un
      // bloc JSDoc : ne sauter que « // » faisait passer « /** », « * » et
      // « */ » pour des noms de champs, et le test rendait alors une liste de
      // fragments de commentaire au lieu de sa vraie réponse.
      && !l.startsWith("//")
      && !l.startsWith("/*")
      && !l.startsWith("*")
      && !l.startsWith("@@")
    ))
    .map((l) => l.split(/\s+/)[0]);
}

/** Tout le texte de la politique, dans une langue. */
function texte(langue: "fr" | "en"): string {
  const parcourir = (v: unknown): string => {
    if (typeof v === "string") return v + " ";
    if (typeof v === "function") return "";
    if (Array.isArray(v)) return v.map(parcourir).join("");
    if (v && typeof v === "object") return Object.values(v).map(parcourir).join("");
    return "";
  };
  return parcourir(confidentialite[langue]);
}

describe("politique de confidentialité", () => {
  const champs = champsDuCompte();

  it("lit bien le modèle User", () => {
    expect(champs).toContain("poids");
    expect(champs.length).toBeGreaterThan(20);
  });

  it("décrit chaque champ personnel du compte, ou dit pourquoi il en est absent", () => {
    const fr = texte("fr");
    const oublies = champs.filter((c) => {
      if (c in HORS_POLITIQUE) return false;
      const motif = ATTENDU[c];
      return !motif || !motif.test(fr);
    });
    expect(oublies).toEqual([]);
  });

  it("ne prétend plus qu'aucune donnée de santé n'est collectée", () => {
    // L'affirmation exacte qui était fausse, dans les deux langues publiées.
    expect(texte("fr")).not.toMatch(/aucune donnée de santé/i);
    expect(texte("en")).not.toMatch(/no health data/i);
  });

  it("nomme la base légale des données de santé", () => {
    // Le consentement explicite de l'article 9.2.a, pas seulement celui du 6.1.a.
    expect(texte("fr")).toMatch(/9\.2\.a/);
    expect(texte("en")).toMatch(/9\.2\.a/);
  });

  it("annonce le droit de retirer son consentement", () => {
    expect(texte("fr")).toMatch(/retirer votre consentement/i);
    expect(texte("en")).toMatch(/withdraw consent/i);
  });
});
