import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Ce que `public/` sert, et ce que le code demande.
 *
 * Next.js sert TOUT ce qu'il trouve dans `public/`, à l'adresse que donne son
 * chemin. Personne ne décide fichier par fichier : ce qui est posé là est en
 * ligne. Deux défauts en découlent, symétriques, et tous deux muets — c'est la
 * même paire que les pages orphelines et les liens morts, un étage plus bas :
 *
 * - un fichier que plus rien ne demande reste servi. Trois captures d'écran
 *   ont survécu six jours à la galerie retirée de la page d'accueil, pour
 *   664 ko ; deux notes écrites pour le propriétaire du site répondaient 200 à
 *   qui demandait `/images/jeux/LISEZ-MOI.md`.
 * - un chemin écrit dans le code dont le fichier n'existe pas donne une image
 *   cassée, et ça ne se voit qu'à l'écran de quelqu'un.
 *
 * `codeMort.test.ts` ne peut voir ni l'un ni l'autre : il ne lit que `src`, et
 * un fichier de `public/` n'est importé par personne — c'est le serveur de
 * fichiers qui le trouve, par son chemin.
 */
const PUBLIC = join(__dirname, "..", "public");

/**
 * Ce qui est servi sans que le code le nomme, chacun avec sa raison.
 *
 * Une exemption sans raison écrite finit par toutes les couvrir.
 */
const SANS_APPELANT: Record<string, string> = {
  "riot.txt":
    "fichier de vérification que Riot exige à une adresse fixe : c'est LUI qui le demande, aucune ligne de ce dépôt n'a de raison de le nommer",
  "images/jeux/":
    "les logos sont trouvés par `logosJeux.ts`, qui compose `/images/jeux/<code>.<ext>` — aucun chemin n'est écrit en clair, et `logosJeux.test.ts` tient déjà la correspondance avec le catalogue",
};

/**
 * Ce qui est servi à une adresse publique sans être un fichier de `public/`.
 *
 * Next.js engendre ces deux-là depuis une route. Ils EXISTENT donc, et un
 * chemin qui les nomme ne pointe pas dans le vide — mais on ne les trouvera
 * jamais sur le disque à cet endroit.
 */
const ENGENDRES: Record<string, string> = {
  "/robots.txt": "src/app/robots.ts",
  "/manifest.webmanifest": "src/app/manifest.ts",
};

/**
 * Les chemins écrits en clair dont le fichier peut légitimement manquer.
 */
const ABSENCE_PREVUE: Record<string, string> = {
  "src/lib/videoBoucle.ts":
    "la vidéo de démonstration n'a pas encore été tournée : le module constate sa présence sur le disque et ne rend AUCUNE balise tant qu'elle manque — c'est tout son objet",
};

function fichiers(dossier: string, prefixe = ""): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) trouves.push(...fichiers(complet, `${prefixe}${entree}/`));
    else trouves.push(prefixe + entree);
  }
  return trouves;
}

/**
 * Tout ce qui peut NOMMER un fichier public.
 *
 * `public/` en fait partie : `sw.js` est le seul à connaître la page de
 * secours hors ligne, et c'est bien du code.
 */
function sources(dossier: string): { chemin: string; texte: string }[] {
  const lues: { chemin: string; texte: string }[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      if (entree === "generated" || entree === "node_modules" || entree === ".next") continue;
      lues.push(...sources(complet));
      // Les tests ne DEMANDENT rien : ils fabriquent des cas. `videoBoucle`
      // nomme quatre fichiers qui n'existent pas, et c'est tout son sujet.
    } else if (/\.(ts|tsx|js|jsx|html|css)$/.test(entree) && !/\.(test|spec)\.[jt]sx?$/.test(entree)) {
      lues.push({ chemin: relative(join(__dirname, ".."), complet), texte: readFileSync(complet, "utf8") });
    }
  }
  return lues;
}

const RACINE = join(__dirname, "..");
const SOURCES = [
  ...sources(join(RACINE, "src")),
  ...sources(join(RACINE, "desktop", "src")),
  ...sources(join(RACINE, "e2e")),
  ...sources(join(RACINE, "scripts")),
  ...sources(PUBLIC),
];

const SERVIS = fichiers(PUBLIC).sort();

/** Les chemins d'apparence publique écrits en clair dans le code. */
const DEMANDES = SOURCES.flatMap(({ chemin, texte }) =>
  [...texte.matchAll(/["'`(](\/(?:images|videos)\/[^"'`)$\s]+|\/[\w.-]+\.(?:html|txt|js|webmanifest))["'`)]/g)].map(
    (t) => ({ chemin, cible: t[1] }),
  ),
);

describe("les fichiers de public/", () => {
  it("recense vraiment quelque chose", () => {
    // Sans ce témoin, un dossier renommé rendrait les deux listes vides et les
    // deux contrôles verts en n'ayant rien regardé.
    expect(SERVIS.length).toBeGreaterThan(8);
    expect(SOURCES.length).toBeGreaterThan(200);
    expect(DEMANDES.length).toBeGreaterThan(3);
  });

  it("sont tous demandés par quelque chose", () => {
    const orphelins = SERVIS.filter((f) => {
      if (f in SANS_APPELANT) return false;
      if (Object.keys(SANS_APPELANT).some((e) => e.endsWith("/") && f.startsWith(e))) return false;
      // Un fichier ne se justifie pas lui-même.
      return !DEMANDES.some((d) => d.cible === `/${f}` && d.chemin !== join("public", f));
    });
    expect({ orphelins }).toEqual({ orphelins: [] });
  });

  it("ne fait demander aucun fichier qui n'existe pas", () => {
    const introuvables = [...new Set(
      DEMANDES.filter((d) => !(d.chemin in ABSENCE_PREVUE))
        .filter((d) => !(d.cible in ENGENDRES))
        .filter((d) => !SERVIS.includes(d.cible.slice(1)))
        .map((d) => `${d.chemin} → ${d.cible}`),
    )].sort();
    expect({ introuvables }).toEqual({ introuvables: [] });
  });

  it("n'exempte que ce qui existe encore", () => {
    const fantomes = Object.keys(SANS_APPELANT).filter((e) =>
      e.endsWith("/") ? !SERVIS.some((f) => f.startsWith(e)) : !SERVIS.includes(e),
    );
    const dispenses = Object.keys(ABSENCE_PREVUE).filter(
      (f) => !SOURCES.some((s) => s.chemin === f),
    );
    const engendres = Object.values(ENGENDRES).filter(
      (f) => !SOURCES.some((s) => s.chemin === f),
    );
    expect({ fantomes, dispenses, engendres }).toEqual({
      fantomes: [],
      dispenses: [],
      engendres: [],
    });
  });
});
