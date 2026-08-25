/**
 * Aucune route d'API ne part sans verrou.
 *
 * Chaque route est déjà éprouvée une par une : refus sans session, refus pour
 * un compte non administrateur, filtrage par compte. Ce sont de bons tests, et
 * ils ont un angle mort : ils ne disent rien de la route qu'on ajoutera
 * demain. Une nouvelle route sans contrôle passe la suite au vert, parce que
 * personne n'a écrit le test qui aurait dû la refuser.
 *
 * Celui-ci regarde le dossier plutôt que les fichiers connus. Il refuse toute
 * route qui ne demande pas de session, sauf inscription explicite ci-dessous
 * avec la raison. Et pour les routes ainsi dispensées, il exige un autre
 * verrou dès qu'elles écrivent en base : une porte ouverte qui ne fait que
 * lire est une décision, une porte ouverte qui écrit est un accident.
 */
import fs from "node:fs";
import path from "node:path";
import { estCheminPublic, PREFIXES_PUBLICS } from "@/lib/routesPubliques";

const RACINE = path.join(process.cwd(), "src", "app", "api");

/**
 * Les routes qui n'exigent pas de session, et pourquoi.
 *
 * Ce n'est pas une liste de tolérances : c'est la liste des endroits où le
 * produit a délibérément ouvert une porte, avec ce qui la garde à la place.
 */
const SANS_SESSION: Record<string, string> = {
  "auth/[...nextauth]":
    "appartient à Auth.js, qui porte ses propres contrôles",
  "auth/desktop-complete":
    "efface la session du navigateur et redirige ; il n'y a rien derrière à protéger",
  "auth/desktop-round":
    "ouvre un tour de connexion pour l'application, donc avant qu'il existe une session",
  "auth/desktop-token":
    "vérifie la session par auth() et un cookie de tour à usage unique",
  "auth/forgot-code":
    "on ne peut pas exiger une session pour récupérer un accès perdu ; limitée par adresse IP et par adresse électronique",
  "auth/register":
    "création de compte, donc avant toute session ; limitée par adresse IP",
  "auth/reset-code":
    "valide un jeton reçu par courriel, qui est la preuve à la place de la session ; limitée par adresse IP",
  "auth/session-expired":
    "efface la session et redirige vers la connexion",
  "auth/session-volatile":
    "vérifie la session par auth() et se contente de réécrire le cookie du demandeur",
  "beta-access":
    "inscription à la bêta, donc avant toute session ; limitée par adresse IP",
  "champions":
    "liste de champions sans rien de nominatif ; le middleware la couvre déjà",
  "exercices/ratios":
    "trois nombres de configuration, déjà présents dans le HTML de chaque page",
  "init":
    "amorçage de la configuration avant qu'il existe le moindre compte ; protégée par INIT_SECRET",
  "mail/hebdo":
    "déclencheur programmé appelé par GitHub Actions ; protégée par RAPPEL_SECRET",
  "obs/[jeton]":
    "un logiciel de diffusion n'a ni cookie ni session : l'adresse est le laissez-passer, et la réponse ne porte rien de nominatif",
  "push/programme":
    "déclencheur programmé appelé par GitHub Actions ; protégée par RAPPEL_SECRET",
  "sante":
    "sonde de supervision : exiger une session la rendrait muette le jour où c'est l'authentification qui est tombée",
};

/** Les verrous qui remplacent valablement une session. */
const VERROUS = [
  /isRateLimited/,      // limite par adresse IP ou par compte visé
  /INIT_SECRET/,        // secret partagé d'amorçage
  /RAPPEL_SECRET/,      // secret partagé des déclencheurs programmés
  /verificationToken/,  // jeton reçu par courriel
  /jetonObs/,           // adresse-laissez-passer d'une source de diffusion
  /\bauth\(\)/,         // session lue directement, sans getCurrentUser
];

/** Écrire en base : ce qui distingue une porte ouverte d'une vitrine. */
const ECRITURE = /prisma\.\w+\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\b/;

/** Toutes les routes, nommées comme dans l'adresse : « admin/users/[id] ». */
function routes(): { nom: string; texte: string }[] {
  const trouvees: { nom: string; texte: string }[] = [];
  const parcourir = (dossier: string) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(complet);
      else if (e.name === "route.ts") {
        trouvees.push({
          nom: path.relative(RACINE, dossier).replace(/\\/g, "/"),
          texte: fs.readFileSync(complet, "utf8"),
        });
      }
    }
  };
  parcourir(RACINE);
  return trouvees;
}

describe("porte des routes d'API", () => {
  const toutes = routes();

  it("trouve bien toutes les routes", () => {
    // Sans ce contrôle, un chemin qui cesserait de correspondre rendrait une
    // liste vide, et les deux tests suivants passeraient en ne regardant rien.
    expect(toutes.length).toBeGreaterThan(40);
    expect(toutes.map((r) => r.nom)).toContain("dashboard");
  });

  /**
   * Une route dispensée de session doit être JOIGNABLE.
   *
   * Deux listes indépendantes gouvernent l'accès : `SANS_SESSION` ci-dessus,
   * qui dit quelles routes n'exigent pas de session, et `PUBLIC_PREFIXES`
   * dans `middleware.ts`, qui dit lesquelles traversent le middleware. Rien
   * ne les reliait, et elles ont divergé : quatre routes explicitement
   * dispensées ici étaient redirigées vers `/login` en 307 avant d'atteindre
   * leur propre contrôle.
   *
   * Le prix a été payé en silence. Le rappel du matin, le bilan hebdomadaire
   * et la relance des absents n'ont jamais été envoyés, et les travaux
   * programmés rendaient du vert : par conception ils notent un code
   * inattendu en avertissement plutôt que d'échouer, pour ne pas noyer
   * l'alerte. Un commentaire de cette même liste affirmait même que « le
   * middleware la couvre déjà » à propos d'une route qu'il ne couvrait pas.
   */
  it("celles qui s'en dispensent traversent le middleware", () => {
    // La règle est IMPORTÉE, pas relue au texte et réimplémentée ici. Deux
    // exemplaires d'une comparaison finissent par diverger, et c'est
    // précisément la divergence qu'on éprouve.
    // Sans ce contrôle, une liste vide ferait passer le test en ne regardant
    // rien : c'est exactement la forme d'erreur qu'on corrige ici.
    expect(PREFIXES_PUBLICS.length).toBeGreaterThan(10);

    const bloquees = Object.keys(SANS_SESSION)
      // Un segment dynamique se remplace par une valeur quelconque :
      // `/api/obs/[jeton]` se demande à `/api/obs/xxx`.
      .map((nom) => `/api/${nom.replace(/\[[^\]]+\]/g, "xxx")}`)
      .filter((chemin) => !estCheminPublic(chemin))
      .sort();
    expect(bloquees).toEqual([]);
  });

  it("chacune exige une session, ou dit pourquoi elle s'en dispense", () => {
    const ouvertes = toutes
      .filter((r) => !/getCurrentUser/.test(r.texte))
      .filter((r) => !(r.nom in SANS_SESSION))
      .map((r) => r.nom);
    expect(ouvertes).toEqual([]);
  });

  it("celles qui s'en dispensent et qui écrivent en base ont un autre verrou", () => {
    // Une porte ouverte qui ne fait que lire est une décision. Une porte
    // ouverte qui écrit sans rien pour la garder est un accident.
    const sansVerrou = toutes
      .filter((r) => r.nom in SANS_SESSION && ECRITURE.test(r.texte))
      .filter((r) => !VERROUS.some((v) => v.test(r.texte)))
      .map((r) => r.nom);
    expect(sansVerrou).toEqual([]);
  });

  it("toute route d'administration vérifie l'administrateur", () => {
    // Une session suffit à atteindre les routes d'admin : c'est `estAdmin` qui
    // les garde, et lui seul. Les tests par route le vérifient un par un, ce
    // qui est bon — mais ils ne disent rien de la route qu'on ajoutera demain,
    // et une route d'admin ouverte à tout compte connecté est le pire des
    // accidents : elle réinitialise des mots de passe et lit tous les comptes.
    const admin = toutes.filter((r) => r.nom === "admin" || r.nom.startsWith("admin/"));
    // Sans ce contrôle, un dossier renommé rendrait le test vert sur zéro route.
    expect(admin.length).toBeGreaterThan(5);

    const sansGarde = admin.filter((r) => !/estAdmin\s*\(/.test(r.texte)).map((r) => r.nom);
    expect(sansGarde).toEqual([]);
  });

  it("le contrôle d'administrateur ne se recopie pas à la main", () => {
    // Une adresse écrite en dur dans une route est un second endroit à changer
    // le jour où la liste bouge, et celui qu'on oublie.
    const enDur = toutes
      .filter((r) => /@[a-z0-9.-]+\.[a-z]{2,}"/.test(r.texte.replace(/^\s*(\/\/|\*).*$/gm, "")))
      .map((r) => r.nom);
    expect(enDur).toEqual([]);
  });

  it("chaque dispense porte une raison écrite, et concerne une route réelle", () => {
    const noms = new Set(toutes.map((r) => r.nom));
    for (const [nom, raison] of Object.entries(SANS_SESSION)) {
      // Une dispense qui survit à la route qu'elle couvrait finit par en
      // couvrir une autre, portant le même nom et rien à voir.
      expect(noms.has(nom)).toBe(true);
      expect(raison.length).toBeGreaterThan(30);
    }
  });
});
