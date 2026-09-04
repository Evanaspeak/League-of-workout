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

/**
 * Les colonnes qui portent le compte.
 *
 * Le contrôle ne cherchait que `userId`, ce qui était vrai de toutes les
 * tables du jour. `Amitie` en porte DEUX et n'en porte aucune de ce nom : un
 * lien a un demandeur et un receveur, et filtrer sur l'un ou sur l'autre est
 * exactement le même geste. Les nommer évite de devoir dispenser une route qui
 * filtre correctement — la dispense la plus dangereuse qui soit, puisqu'elle
 * rend le garde muet sur tout le fichier.
 *
 * `parrainId` a rejoint la liste avec le parrainage : compter ses filleuls,
 * c'est filtrer `User` sur son propre compte, par une colonne qui pointe vers
 * lui.
 */
const COLONNES_DE_COMPTE = ["userId", "demandeurId", "receveurId", "parrainId"];

/**
 * Appels qui ne portent légitimement aucun compte, un par un.
 *
 * Plus fin qu'une dispense de route, et c'est le but : dispenser `amis` en
 * entier rendrait le garde aveugle aux neuf autres requêtes du même fichier,
 * qui doivent toutes filtrer.
 */
const APPELS_HORS_COMPTE: Record<string, string> = {
  "amis : user.findMany":
    "Résoudre un pseudo en compte, c'est regarder chez quelqu'un d'autre : c'est tout l'objet d'« ajouter un ami ». Le `select` ne rend que l'identifiant et le pseudo, et deux homonymes font refuser au lieu de choisir.",
  "classement : user.findMany":
    "Le mur des records OUVERT (ligne 141) : par définition il regarde des " +
    "comptes qui ne sont pas les vôtres. Deux conditions le bornent, et elles " +
    "sont en base : `recordsPublics` — le choix de la personne, faux par " +
    "défaut — et `fantome`, qui reste au-dessus. Le `select` ne rend que ce " +
    "qui compose un pseudo. Déclarée ici bien que le garde ne l'exige pas : sa " +
    "fenêtre attrape le filtre de l'appel voisin.",
  "progression : paiement.groupBy":
    "L'objectif collectif (ligne 133) : la seule lecture du produit qui somme " +
    "l'effort de TOUT LE MONDE. Ce qui en sort est un total et un décompte de " +
    "contributeurs — aucun pseudo, aucune ligne, rien qui désigne quelqu'un. " +
    "Elle est déclarée ici bien que le garde ne l'exige pas : sa fenêtre de " +
    "quatre cents caractères attrape le filtre de l'appel VOISIN, donc il la " +
    "laisserait passer en silence. Une lecture sans filtre se déclare là où " +
    "on la cherchera, pas là où le motif veut bien la voir.",
  "groupes : groupe.create":
    "Un groupe qu'on vient de créer n'appartient encore à personne. L'appartenance s'écrit à la ligne suivante, et c'est elle qui porte le compte.",
};

const OPERATIONS = [
  "findMany", "findFirst", "findUnique", "findUniqueOrThrow", "update",
  "updateMany", "delete", "deleteMany", "count", "aggregate", "groupBy",
  "upsert", "create", "createMany",
].join("|");

/**
 * La colonne compte comme un FILTRE quand elle est une clé, pas quand elle est
 * une chaîne ou une lecture de résultat.
 *
 * Le journal décrivait ce resserrement depuis l'arrivée du classement ; le
 * code, lui, cherchait encore le nom n'importe où dans les quatre cents
 * caractères. `groupBy({ by: ["userId"] })` le donne comme axe de regroupement
 * et `s.userId` le lit dans le résultat : ni l'un ni l'autre ne filtre quoi que
 * ce soit.
 *
 * Ce qui précède le nom suffit à écarter les deux : un guillemet en fait une
 * chaîne, un point une lecture. Ce qui SUIT tranche le reste — deux points pour
 * `userId: …`, une virgule ou une accolade pour le raccourci d'objet
 * `{ id, userId }`, qui est un filtre parfaitement juste et qu'il ne faut pas
 * recaler.
 *
 * Elle est sortie de la boucle pour être ÉPROUVÉE : sur les routes réelles,
 * remettre la recherche naïve ne fait tomber aucun contrôle, faute d'un cas qui
 * les distingue. Un resserrement qu'aucun test ne peut voir n'est pas un
 * resserrement.
 */
export function porteUnFiltre(autour: string): boolean {
  return COLONNES_DE_COMPTE.some((c) =>
    new RegExp(`(?<![."'\`\\w])${c}\\s*[:,}]`).test(autour));
}

function routes(): { nom: string; texte: string }[] {
  const trouvees: { nom: string; texte: string }[] = [];
  const parcourir = (dossier: string) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(complet);
      /**
       * `route.ts` ET `route.tsx`.
       *
       * Next accepte les deux, et trois routes de ce projet sont en `.tsx` —
       * les deux images rendues par `next/og` et l'icône PWA. Elles étaient
       * donc INVISIBLES à ce recensement depuis qu'elles existent : le garde
       * ne trouvait rien à leur reprocher parce qu'il ne les lisait pas.
       * Éprouvé en neutralisant le verrou de session de `seance/image`, qui
       * n'a fait tomber aucun test.
       */
      else if (e.name === "route.ts" || e.name === "route.tsx") {
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
        const appel = `${r.nom} : ${modele}.${m[3]}`;
        if (appel in APPELS_HORS_COMPTE) continue;
        const autour = r.texte.slice(Math.max(0, m.index! - 400), m.index! + m[0].length + 400);
        /**
         * La colonne compte comme un FILTRE quand elle est une clé, pas quand
         * elle est une chaîne ou une lecture de résultat.
         *
         * Le journal décrivait ce resserrement depuis l'arrivée du classement ;
         * le code, lui, cherchait encore le nom n'importe où dans les quatre
         * cents caractères. `groupBy({ by: ["userId"] })` le donne comme axe de
         * regroupement et `s.userId` le lit dans le résultat : ni l'un ni
         * l'autre ne filtre quoi que ce soit, et les deux faisaient passer une
         * requête qui lit toute la base. Une somme collective ajoutée cette
         * nuit est entrée ainsi, sans que rien ne le dise.
         *
         * Ce qui précède le nom suffit à trancher : un guillemet en fait une
         * chaîne, un point une lecture. Ce qui SUIT tranche le reste : deux
         * points pour `userId: …`, une virgule ou une accolade pour le
         * raccourci d'objet `{ id, userId }`, qui est un filtre parfaitement
         * juste et qu'il ne faut pas recaler.
         */
        if (porteUnFiltre(autour)) continue;
        if (/\bid:\s*(user|me|moi)\.id/.test(autour)) continue;
        nus.push(appel);
      }
    }
    expect(nus).toEqual([]);
  });

  it("chaque appel dispensé désigne encore un appel qui existe", () => {
    // Une dispense qui ne désigne plus rien est du code mort qu'on a fini par
    // admettre — et elle ouvre un nom que la prochaine route pourrait reprendre.
    const motif = new RegExp(`(prisma|tx)\\.([a-zA-Z]+)\\.(${OPERATIONS})\\b`, "g");
    const vus = new Set<string>();
    for (const r of toutes) {
      for (const m of r.texte.matchAll(motif)) vus.add(`${r.nom} : ${m[2]}.${m[3]}`);
    }
    const mortes = Object.keys(APPELS_HORS_COMPTE).filter((a) => !vus.has(a));
    expect(mortes).toEqual([]);
  });

  it("chaque appel dispensé porte sa raison", () => {
    for (const [appel, raison] of Object.entries(APPELS_HORS_COMPTE)) {
      expect(raison.length).toBeGreaterThan(40);
      expect(appel).toMatch(/ : \w+\.\w+$/);
    }
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

describe("ce qui compte pour un filtre", () => {
  it("accepte une clé, et le raccourci d'objet", () => {
    expect(porteUnFiltre("where: { userId: user.id }")).toBe(true);
    expect(porteUnFiltre("where: { id, userId }")).toBe(true);
    expect(porteUnFiltre("where: { demandeurId: moi }")).toBe(true);
  });

  it("REFUSE un axe de regroupement et une lecture de résultat", () => {
    /**
     * Les deux cas qui ont laissé passer une requête lisant toute la base :
     * `by: ["userId"]` nomme la colonne sans rien filtrer, et `s.userId` la lit
     * dans le résultat. Une somme collective est entrée par là.
     */
    expect(porteUnFiltre('groupBy({ by: ["userId"], _sum: { points: true } })')).toBe(false);
    expect(porteUnFiltre("sommes.map((s) => s.userId)")).toBe(false);
    expect(porteUnFiltre("select: { userId: true }")).toBe(true);
  });

  it("ne voit rien là où il n'y a rien", () => {
    expect(porteUnFiltre("findMany({ orderBy: { jour: \"desc\" } })")).toBe(false);
  });
});
