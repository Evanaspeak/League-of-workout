/**
 * Une fenêtre qui recouvre l'écran doit se dire fenêtre.
 *
 * Sans `role="dialog"` et `aria-modal`, un lecteur d'écran lit la fenêtre
 * comme un morceau de page ordinaire : rien n'annonce qu'elle s'est ouverte,
 * rien ne dit qu'il faut en sortir avant de continuer, et le contenu derrière
 * reste parcourable alors qu'il est inaccessible à la souris.
 *
 * Trois fenêtres étaient dans ce cas — accueil, décompte de dette, suppression
 * de compte — et l'audit d'accessibilité les avait toutes trouvées « sans rien
 * à signaler », parce qu'il ne cherchait pas ce qui manquait. Ce test cherche
 * ce qui manque : il refuse tout recouvrement plein écran qui ne se déclare
 * pas. C'est statique, donc il voit aussi les fenêtres qui ne sont pas
 * ouvertes au moment où l'on regarde.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Le motif d'un recouvrement plein écran.
 *
 * Cherché sur le fichier dont les espaces ont été aplatis : la première
 * version lisait le texte tel quel et ratait tous les styles écrits sur
 * plusieurs lignes — dont `OnboardingModal`, c'est-à-dire précisément la
 * fenêtre qui a motivé ce test.
 */
const PLEIN_ECRAN = /position:\s*["']fixed["']\s*,\s*inset:\s*0/;

/**
 * Ce qui recouvre l'écran sans être une fenêtre modale, et pourquoi.
 *
 * L'exemption se justifie fichier par fichier : un recouvrement qui ne
 * capture ni le focus ni l'attention n'a pas à s'annoncer comme une fenêtre.
 */
const PAS_DES_FENETRES: Record<string, string> = {
  "app/obs/[jeton]/VueDiffusion.tsx":
    "page entière d'une source de diffusion, pas une fenêtre par-dessus autre chose",
  "components/SplashScreen.tsx":
    "écran d'ouverture : il ne pose aucune question et disparaît seul, personne n'a à en sortir",
};

function fichiersTsx(racine: string): string[] {
  const sortie: string[] = [];
  for (const entree of fs.readdirSync(racine, { withFileTypes: true })) {
    const complet = path.join(racine, entree.name);
    if (entree.isDirectory()) sortie.push(...fichiersTsx(complet));
    else if (entree.name.endsWith(".tsx")) sortie.push(complet);
  }
  return sortie;
}

describe("fenêtres modales", () => {
  const src = path.join(process.cwd(), "src");
  const suspects = fichiersTsx(src)
    .map((f) => ({ chemin: path.relative(src, f), texte: fs.readFileSync(f, "utf8") }))
    .filter(({ texte }) => PLEIN_ECRAN.test(texte.replace(/\s+/g, " ")));

  it("trouve bien les recouvrements plein écran", () => {
    // Sans ce contrôle, un motif qui cesserait de correspondre rendrait une
    // liste vide, et le test suivant passerait en ne regardant rien.
    expect(suspects.length).toBeGreaterThan(4);
    expect(suspects.map((s) => s.chemin)).toContain("components/OnboardingModal.tsx");
  });

  it("chacune se déclare, ou dit pourquoi elle n'en est pas une", () => {
    const muettes = suspects
      .filter(({ chemin }) => !(chemin.replace(/\\/g, "/") in PAS_DES_FENETRES))
      .filter(({ texte }) => !/role=["']dialog["']/.test(texte)
        || !/aria-modal/.test(texte))
      .map(({ chemin }) => chemin);
    expect(muettes).toEqual([]);
  });
});
