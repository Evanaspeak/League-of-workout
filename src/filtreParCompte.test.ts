import fs from "node:fs";
import path from "node:path";

/**
 * Toute requête en base part filtrée sur le compte du demandeur.
 *
 * C'est la règle qui protège vraiment les comptes entre eux, et la seule dont
 * l'oubli est immédiatement grave : une route qui lit `Game` sans `userId`
 * rend l'historique de quelqu'un d'autre. Les tests par route la vérifient une
 * par une, ce qui est bon — et ne dit rien de la route qu'on ajoutera demain.
 *
 * Le contrôle est un motif, donc grossier. Il regarde les quatre cents
 * caractères de part et d'autre de chaque appel : ça suffit pour attraper le
 * `where` de l'appel lui-même, et aussi le cas légitime où les identifiants
 * viennent d'une requête filtrée juste au-dessus (`games/dates`, `push`).
 */

const RACINE = path.join(process.cwd(), "src", "app", "api");

/**
 * Tables qui n'appartiennent à personne : configuration globale du barème,
 * limiteur, jetons de récupération, candidatures. Les filtrer par compte
 * n'aurait aucun sens.
 */
const SANS_PROPRIETAIRE = new Set([
  "levelConfig", "roleWeight", "masteryConfig", "systemConfig",
  "betaApplication", "loginAttempt", "verificationToken",
]);

/**
 * Routes qui agissent légitimement hors du compte courant, chacune avec sa
 * raison. Une septième devrait faire se demander si le garde sert encore.
 */
const HORS_COMPTE: Record<string, string> = {
  "admin": "Le panneau d'administration agit sur les autres comptes : c'est sa raison d'être. C'est `estAdmin` qui le garde, et un autre test l'exige sur chaque route du dossier.",
  "auth": "L'inscription et la récupération n'ont pas encore de session : c'est justement ce qu'elles créent. Le limiteur par adresse et le jeton reçu par courriel y tiennent lieu de verrou.",
  "beta-access": "Même chose : la route qui ouvre un compte ne peut pas le filtrer sur un compte qui n'existe pas encore.",
  "obs/[jeton]": "L'adresse EST le laissez-passer, et le jeton fait office de filtre. La réponse ne porte qu'un nombre d'exercices dus et une série de jours.",
  "mail/hebdo": "Un envoi programmé parcourt tous les comptes : c'est le travail. Il est gardé par le secret partagé du déclencheur.",
  "push/programme": "Même chose pour le rappel du matin et la relance des absents.",
};

const OPERATIONS = [
  "findMany", "findFirst", "findUnique", "findUniqueOrThrow", "update",
  "updateMany", "delete", "deleteMany", "count", "aggregate", "groupBy",
  "upsert", "create", "createMany",
].join("|");

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

/** Vrai si la route relève d'une dispense écrite. */
function dispensee(nom: string): boolean {
  return Object.keys(HORS_COMPTE).some((prefixe) => nom === prefixe || nom.startsWith(`${prefixe}/`));
}

describe("filtrage par compte", () => {
  const toutes = routes();

  it("trouve bien toutes les routes", () => {
    // Sans ce contrôle, un chemin qui cesserait de correspondre rendrait le
    // test vert sur zéro fichier lu.
    expect(toutes.length).toBeGreaterThan(40);
  });

  it("chaque requête en base porte le compte du demandeur, ou relève d'une dispense", () => {
    const motif = new RegExp(`(prisma|tx)\\.([a-zA-Z]+)\\.(${OPERATIONS})\\b`, "g");
    const nus: string[] = [];
    for (const r of toutes) {
      if (dispensee(r.nom)) continue;
      for (const m of r.texte.matchAll(motif)) {
        const modele = m[2];
        if (SANS_PROPRIETAIRE.has(modele)) continue;
        const autour = r.texte.slice(Math.max(0, m.index! - 400), m.index! + m[0].length + 400);
        if (/userId/.test(autour) || /\bid:\s*(user|me|moi)\.id/.test(autour)) continue;
        nus.push(`${r.nom} : ${modele}.${m[3]}`);
      }
    }
    expect(nus).toEqual([]);
  });

  it("le motif trouve réellement des appels : sinon il ne contrôle rien", () => {
    const motif = new RegExp(`(prisma|tx)\\.([a-zA-Z]+)\\.(${OPERATIONS})\\b`, "g");
    const total = toutes.reduce((n, r) => n + [...r.texte.matchAll(motif)].length, 0);
    expect(total).toBeGreaterThan(60);
  });

  it("chaque dispense porte une raison écrite, et désigne une route réelle", () => {
    for (const [prefixe, raison] of Object.entries(HORS_COMPTE)) {
      expect({ prefixe, existe: toutes.some((r) => dispensee(r.nom) && (r.nom === prefixe || r.nom.startsWith(`${prefixe}/`))) })
        .toEqual({ prefixe, existe: true });
      expect(raison.length).toBeGreaterThan(60);
    }
  });
});
