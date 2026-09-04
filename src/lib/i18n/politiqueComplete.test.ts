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
  /**
   * Conduite au démarrage d'un jeu : demander, lancer seul, ne rien faire.
   *
   * C'est un réglage de comportement de l'application, pas une donnée sur la
   * personne : il ne sort jamais du compte, ne part dans aucun courriel et ne
   * dit rien de ce qu'elle fait. La langue et le fuseau, eux, ont dû entrer
   * dans la politique parce qu'ils servent HORS de l'Application — à écrire un
   * courriel, à choisir l'heure d'un envoi. Ce n'est pas le cas ici.
   */
  sessionAuto: "réglage de comportement de l'application",
  exercices: "réglage : exercices choisis pour payer",
  rappelSeuilPoints: "réglage de rappel (ancienne version)",
  rappelSeuilSec: "réglage de rappel",
  plafondQuotidien: "réglage d'avertissement de volume",
  relanceLe: "date d'un envoi que nous avons fait, pas une donnée fournie",
  rappelLe: "date d'un envoi que nous avons fait, pas une donnée fournie",

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
  /**
   * Les efforts que d'AUTRES ont faits pour acquitter votre dette.
   *
   * C'est la dette commune d'une équipe. Elle se décrit et ne s'exempte pas,
   * pour la raison qui vaut déjà pour la liste d'amis : ce n'est pas seulement
   * un renseignement sur vous, c'en est un sur quelqu'un d'autre — le nom de
   * celui qui a fait l'effort — et il traverse le compte.
   */
  relaisRecus: /dette d'équipe|dette commune/i,
  /**
   * Qui sont vos amis et dans quels groupes vous êtes.
   *
   * Trois relations, et pas une exemption : c'est le renseignement le plus
   * personnel que le social produise. Il ne dit pas seulement quelque chose de
   * vous, il en dit sur quelqu'un d'autre — et il sort du compte, puisque
   * c'est tout son objet. La politique dit donc ce qu'une amitié donne à voir,
   * et qu'elle se retire.
   */
  amitiesEnvoyees: /liste d'amis/i,
  amitiesRecues: /liste d'amis/i,
  groupes: /groupes rejoints/i,
  /**
   * Le mode fantôme se décrit plutôt qu'il ne s'exempte.
   *
   * C'est un réglage d'affichage, donc exemptable au sens strict — mais c'est
   * surtout un CONTRÔLE de confidentialité, et une politique qui ne le
   * mentionne pas rate l'endroit exact où quelqu'un cherche à savoir s'il
   * existe. Il figure sur la ligne des amis, avec ce qu'une amitié donne à
   * voir : c'est là qu'on se pose la question.
   */
  /**
   * Le motif désigne la PHRASE sur le mode fantôme, pas le libellé de la ligne
   * qui la porte.
   *
   * Ma première version cherchait « liste d'amis » : elle passait tant que la
   * ligne existait, donc elle serait restée verte si la mention du mode
   * fantôme disparaissait — c'est-à-dire précisément ce qu'elle prétendait
   * garder. Le sabotage l'a dit.
   */
  fantome: /mode fantôme|ghost mode|modo fantasma|geistmodus|隐身模式|ゴーストモード/i,
  /**
   * Ce qu'un ami a le droit de voir. Décrit et non exempté, pour la même
   * raison que le mode fantôme : c'est un contrôle de confidentialité, et la
   * politique est l'endroit où l'on cherche à savoir s'il existe.
   */
  partageAmis: /réglage de partage|sharing setting|ajuste de compartición|freigabe-einstellung|分享设置|共有設定/i,
  /**
   * Le parrainage. Quatre champs, une seule ligne de politique : qui vous a
   * invité et qui vous avez invité sont la même relation lue des deux bouts,
   * et la décrire deux fois ferait croire à deux traitements distincts.
   */
  codeParrain: /parrainage/i,
  parrainId: /parrainage/i,
  parrain: /parrainage/i,
  filleuls: /parrainage/i,
  // Date de début de la dette courante : elle sert au retard, et elle se
  // décrit avec l'historique des paiements plutôt que séparément.
  detteDepuis: /paiements de dette/i,
  jetonObs: /compteur de stream/i,
  /**
   * Le lien du profil public. Il se décrit et ne s'exempte pas : c'est une
   * page qui montre votre pseudo et votre effort à qui a l'adresse, sans
   * session. Le fait qu'elle n'existe que si on l'a demandée ne dispense pas
   * de dire ce qu'elle publie.
   */
  jetonProfil: /profil public/i,
  // Mettre un exercice de côté frôle la santé sans en être : on le décrit
  // plutôt que de l'exempter, et la politique dit qu'aucune raison médicale
  // n'est demandée.
  exercicesSuspendus: /exercices mis de côté/i,
  suspensionDepuis: /exercices mis de côté/i,
  // Dire qu'on fait ses pompes genoux au sol frôle la santé sans en être :
  // la politique le décrit, et dit qu'aucune raison n'est demandée.
  variantePompes: /variante d'exécution des pompes/i,
  // Le fuseau est une indication de lieu, grossière mais réelle : la politique
  // affirmait « aucune donnée de localisation » et ne pouvait plus le dire tel
  // quel. Elle décrit maintenant ce qui est gardé, et ce qui ne l'est pas.
  /**
   * La langue était exemptée comme « réglage d'affichage ».
   *
   * C'en est un dans le navigateur, où il ne nous regarde pas. Rangée sur le
   * compte, elle sert à écrire hors de l'Application — notification, courriel —
   * et elle dit quelque chose de la personne. Elle se décrit donc, comme le
   * fuseau qui l'a précédée sur le même raisonnement.
   */
  langue: /langue choisie/i,
  fuseau: /fuseau horaire/i,
  // Le bilan est le seul envoi récurrent : la politique dit qu'il existe, et
  // qu'il s'arrête. Un envoi récurrent qu'on ne peut pas éteindre n'aurait
  // rien à faire dans un produit.
  bilanActif: /bilan hebdomadaire/i,
  bilanLe: /bilan hebdomadaire/i,
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

  /**
   * Le tableau des données doit avoir le MÊME NOMBRE DE LIGNES partout.
   *
   * Tout le reste de ce fichier ne lit que le français : c'est là que se
   * décide ce qui est décrit, et le faire six fois n'apprendrait rien de plus.
   * Mais ça laissait un trou, et je suis tombé dedans en écrivant la ligne de
   * la dette d'équipe — insérée dans deux langues sur six, tout est resté au
   * vert. Une politique qui décrit une donnée en français et se tait en
   * allemand n'est pas une politique traduite, c'est une politique fausse dans
   * cinq langues.
   *
   * Le compte suffit : la parité des CLÉS est déjà tenue ailleurs, ce qui
   * manquait est la longueur d'un tableau.
   */
  it("le tableau des données a le même nombre de lignes dans les six langues", () => {
    const lignes = (langue: string) => {
      const bloc = confidentialite[langue as keyof typeof confidentialite] as Record<string, unknown>;
      // Le tableau vit sous « 2. Données collectées ». On le cherche par sa
      // FORME — un tableau de tableaux — plutôt que par le nom de l'article,
      // qui n'a aucune raison d'être stable.
      for (const article of Object.values(bloc)) {
        if (!article || typeof article !== "object") continue;
        for (const champ of Object.values(article as Record<string, unknown>)) {
          if (Array.isArray(champ) && champ.length > 5 && Array.isArray(champ[0])) {
            return champ.length;
          }
        }
      }
      return 0;
    };
    const fr = lignes("fr");
    // Sans ce témoin, un tableau introuvable rendrait zéro partout et le test
    // passerait en ne comparant rien.
    expect(fr).toBeGreaterThan(10);
    for (const langue of Object.keys(confidentialite)) {
      expect({ langue, lignes: lignes(langue) }).toEqual({ langue, lignes: fr });
    }
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
