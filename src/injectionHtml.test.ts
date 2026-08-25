import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export {};

/**
 * Le recensement des insertions de HTML brut.
 *
 * Le CSP de l'application autorise `'unsafe-inline'` sur les scripts, et c'est
 * assumé : Next.js pose ses propres scripts en ligne, leur contenu change à
 * chaque construction, et le nonce qui les remplacerait rendrait dynamiques
 * les dix pages publiques dont le temps d'affichage est le seul canal
 * d'acquisition. La raison est écrite dans CLAUDE.md.
 *
 * Ce choix ne tient qu'à une condition : qu'aucune donnée venue d'un compte
 * n'atteigne un point d'injection. Aujourd'hui c'est vrai — deux insertions,
 * deux constantes. Rien ne le dit, rien ne le garde, et ce genre de vérité
 * cesse d'être vraie sans que personne ne s'en aperçoive.
 *
 * Le test n'essaie pas de deviner si une valeur est constante : une analyse
 * qui se trompe dans un sens laisse passer, dans l'autre elle harcèle. Il
 * exige seulement que chaque insertion figure ici avec sa raison, pour que la
 * troisième soit une décision et non un réflexe.
 */

const RACINE = join(process.cwd(), "src");

/** Où l'on insère du HTML brut, et pourquoi c'est sans danger. */
const AUTORISEES: Record<string, string> = {
  "app/page.tsx":
    "Bloc de données structurées pour les moteurs de recherche. JSON.stringify " +
    "d'une constante du module : aucune valeur ne vient d'un compte.",
  "app/layout.tsx":
    "Écouteur de `beforeinstallprompt`, qui doit s'exécuter avant le paquet " +
    "JavaScript. Chaîne littérale écrite dans le fichier, sans interpolation.",
};

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      // `src/generated` est produit par Prisma : il ne rend aucune page.
      if (entree === "generated") continue;
      out.push(...fichiers(chemin));
      continue;
    }
    if (/\.tsx?$/.test(entree) && !/\.test\.tsx?$/.test(entree)) out.push(chemin);
  }
  return out;
}

describe("insertions de HTML brut", () => {
  const tous = fichiers(RACINE);
  const trouvees = tous
    .filter((f) => readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"))
    .map((f) => f.slice(RACINE.length + 1).replace(/\\/g, "/"))
    .sort();

  it("lit bien l'arborescence", () => {
    // Sans ce garde, un dossier renommé rendrait le test vert sur zéro fichier
    // lu, c'est-à-dire sur rien — la forme d'erreur qu'on cherche à éviter.
    expect(tous.length).toBeGreaterThan(100);
  });

  it("n'en compte aucune qui ne soit recensée", () => {
    expect(trouvees).toEqual(Object.keys(AUTORISEES).sort());
  });

  it("chaque insertion recensée porte sa raison", () => {
    for (const raison of Object.values(AUTORISEES)) {
      expect(raison.length).toBeGreaterThan(40);
    }
  });

  it("aucune ne compose son HTML avec une valeur", () => {
    // Un gabarit à interpolation (`${…}`) dans l'argument est le signe le plus
    // net qu'une valeur y entre. Ce n'est pas une preuve d'innocuité — c'est
    // le seul contrôle qu'on puisse écrire sans deviner.
    for (const relatif of Object.keys(AUTORISEES)) {
      const texte = readFileSync(join(RACINE, relatif), "utf8");
      for (const m of texte.matchAll(/dangerouslySetInnerHTML=\{\{([\s\S]{0,600}?)\}\}/g)) {
        expect(m[1]).not.toMatch(/\$\{/);
      }
    }
  });
});
