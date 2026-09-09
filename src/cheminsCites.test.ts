import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Un commentaire qui nomme un fichier doit nommer un fichier qui existe.
 *
 * `useChemin.ts` envoyait lire `src/cheminSansLangue.test.ts` pour savoir ce
 * qui empêche un composant d'appeler `usePathname` en direct. Ce fichier
 * n'existe pas : le garde s'appelle `liensLocalises.test.ts`. Qui suit
 * l'adresse ne trouve rien, et la conclusion la plus naturelle est la pire —
 * « la règle n'est gardée par personne, donc je peux écrire mon
 * `usePathname` ».
 *
 * C'est le motif que ce dépôt paie le plus, sous sa forme la plus discrète :
 * **une adresse qui ne mène nulle part fait cesser de chercher.** Le journal
 * porte déjà le cas d'une décision rangée à une adresse inexistante, et celui
 * d'une réf. qui RÉSOLVAIT vers la mauvaise réponse. Celui-ci est le même, un
 * étage plus bas.
 *
 * Ce garde ne lit QUE les commentaires : un chemin dans une chaîne est du
 * code, et c'est le compilateur ou le serveur de fichiers qui le juge.
 */
const RACINE = join(__dirname, "..");

/**
 * Ce fichier seul est dispensé, et il faut le dire : il RACONTE l'adresse
 * morte qu'il attrape, et ses cas fabriqués en citent d'autres. Un garde qui
 * lit les commentaires tombe sur sa propre explication — le piège est écrit
 * trois fois dans le journal, à chaque fois sous une forme différente.
 */
const LUI_MEME = join(__dirname, "cheminsCites.test.ts");
const DOSSIERS = ["src", "e2e", "desktop/src", "scripts", "prisma"];
const EXTENSIONS = /\.(ts|tsx|js|mjs)$/;

/** Ce qu'on ne parcourt jamais : engendré, installé, ou produit par un outil. */
const IGNORES = new Set([
  "node_modules",
  "generated",
  ".git",
  ".next",
  "playwright-report",
  "test-results",
  "coverage",
  "dist",
]);

/** Un chemin de fichier du dépôt, tel qu'on l'écrit dans une phrase. */
const CHEMIN =
  /\b((?:src|e2e|desktop\/src|scripts|prisma|public|docs|\.github)\/[A-Za-z0-9_\-./[\]]*\.(?:ts|tsx|js|mjs|css|md|yml|sql|json|html))\b/g;

/** Un fichier de test ou de parcours nommé sans son dossier. */
const NOM_SEUL = /\b([A-Za-z0-9_-]+\.(?:test|spec)\.tsx?)\b/g;

function fichiers(dossier: string, garder: (n: string) => boolean, trouves: string[] = []) {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (IGNORES.has(entree.name)) continue;
    const complet = join(dossier, entree.name);
    if (entree.isDirectory()) fichiers(complet, garder, trouves);
    else if (garder(entree.name)) trouves.push(complet);
  }
  return trouves;
}

/**
 * Les commentaires d'un fichier, avec leur numéro de ligne.
 *
 * Le découpage est volontairement naïf — il ne cherche pas à distinguer un
 * `//` d'une adresse `https://`. Le prix d'une confusion est nul : une
 * adresse web ne contient pas de chemin du dépôt.
 */
function commentaires(source: string): [number, string][] {
  const trouves: [number, string][] = [];
  let dansBloc = false;
  source.split("\n").forEach((ligne, i) => {
    if (dansBloc) {
      trouves.push([i + 1, ligne]);
      if (ligne.includes("*/")) dansBloc = false;
      return;
    }
    const bloc = ligne.indexOf("/*");
    const simple = ligne.indexOf("//");
    if (bloc >= 0) {
      trouves.push([i + 1, ligne.slice(bloc)]);
      if (!ligne.includes("*/", bloc + 2)) dansBloc = true;
      return;
    }
    if (simple >= 0) trouves.push([i + 1, ligne.slice(simple)]);
  });
  return trouves;
}

const sources = DOSSIERS.filter((d) => existsSync(join(RACINE, d))).flatMap((d) =>
  fichiers(join(RACINE, d), (n) => EXTENSIONS.test(n)),
);

/** Tous les fichiers du dépôt, par nom de base, pour les citations sans dossier. */
const parNom = new Map<string, number>();
for (const f of fichiers(RACINE, () => true)) {
  const base = f.split("/").pop() as string;
  parNom.set(base, (parNom.get(base) ?? 0) + 1);
}

function citationsMortes() {
  const morts: string[] = [];
  for (const fichier of sources) {
    if (fichier === LUI_MEME) continue;
    for (const [ligne, texte] of commentaires(readFileSync(fichier, "utf8"))) {
      for (const m of texte.matchAll(CHEMIN)) {
        if (!existsSync(join(RACINE, m[1]))) morts.push(`${fichier}:${ligne} → ${m[1]}`);
      }
      for (const m of texte.matchAll(NOM_SEUL)) {
        if (!parNom.has(m[1])) morts.push(`${fichier}:${ligne} → ${m[1]}`);
      }
    }
  }
  return morts;
}

/**
 * La moitié DESCRIPTIVE de `CLAUDE.md`, c'est-à-dire tout ce qui précède le
 * journal.
 *
 * La frontière n'est pas de commodité : au-dessus, le document dit où regarder
 * MAINTENANT, et un chemin mort y envoie chercher un fichier qui n'existe
 * plus ; en dessous, il raconte ce qui était vrai ALORS, et les chemins
 * d'alors sont ce qu'il faut écrire — les deux fichiers du tableau de bord et
 * des réglages avancés vivaient bien là avant que la langue entre dans
 * l'adresse. `comptesDeTests.test.ts` emploie déjà la même frontière, pour la
 * même raison.
 */
function moitieDescriptive(): string {
  const doc = readFileSync(join(RACINE, "CLAUDE.md"), "utf8");
  const [haut] = doc.split("## Journal des corrections");
  return haut;
}

describe("les fichiers cités dans les commentaires existent", () => {
  it("le recensement lit quelque chose", () => {
    // Sans ce contrôle, un dossier renommé rendrait le test vert sur zéro
    // fichier — la forme d'erreur que ce fichier existe pour dire.
    expect(sources.length).toBeGreaterThanOrEqual(300);
    expect(parNom.size).toBeGreaterThanOrEqual(300);
  });

  it("les motifs trouvent réellement les citations", () => {
    // L'état sain du dépôt est ZÉRO trouvaille : il ne peut donc pas montrer
    // qu'un motif devenu aveugle a cessé de chercher. Des cas fabriqués le
    // montrent, dans les deux sens.
    const phrase = " * Voir `src/lib/dette.ts` et `historique.spec.ts`, pas src/rien.ts";
    expect([...phrase.matchAll(CHEMIN)].map((m) => m[1])).toEqual([
      "src/lib/dette.ts",
      "src/rien.ts",
    ]);
    expect([...phrase.matchAll(NOM_SEUL)].map((m) => m[1])).toEqual(["historique.spec.ts"]);
  });

  it("le découpage ne lit que les commentaires", () => {
    const source = ['const a = "src/pas-un-commentaire.ts";', "// src/vraiment-un.ts"].join("\n");
    const lus = commentaires(source)
      .map(([, t]) => t)
      .join(" ");
    expect(lus).toContain("src/vraiment-un.ts");
    expect(lus).not.toContain("src/pas-un-commentaire.ts");
  });

  it("aucun commentaire ne renvoie vers un fichier qui n'existe pas", () => {
    expect(citationsMortes()).toEqual([]);
  });

  it("la moitié descriptive de CLAUDE.md cite des fichiers qui existent", () => {
    const haut = moitieDescriptive();
    // Le découpage a son propre témoin : sans lui, une frontière renommée
    // rendrait le document entier — donc le journal, dont les chemins d'alors
    // sont morts aujourd'hui — et le contrôle échouerait pour la mauvaise
    // raison.
    expect(haut.length).toBeGreaterThan(10_000);
    expect(haut).not.toContain("### Journal");
    const cites = [...haut.matchAll(CHEMIN)].map((m) => m[1]);
    expect(cites.length).toBeGreaterThanOrEqual(20);
    expect(cites.filter((c) => !existsSync(join(RACINE, c)))).toEqual([]);
  });
});
