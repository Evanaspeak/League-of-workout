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
  "app/(diffusion)/obs/[jeton]/VueDiffusion.tsx":
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

/**
 * S'annoncer modale est une PROMESSE, et il faut la tenir au clavier.
 *
 * `aria-modal="true"` dit au lecteur d'écran que le reste de la page n'existe
 * plus. À la souris, la promesse se tient toute seule : le fond est opaque, le
 * clic dessus ferme. Au clavier, non — la tabulation continue dans la page
 * derrière, sur des commandes qu'on ne voit pas, et rien ne dit qu'on en est
 * sorti.
 *
 * Le test précédent a été écrit en août et il a fait son travail : les cinq
 * fenêtres s'annoncent. Il ne dit rien de ce qui vient après l'annonce, et
 * quatre d'entre elles ne retenaient donc RIEN — accueil, décompte de dette,
 * suppression de compte, visite guidée. C'est le même angle mort que la fois
 * d'avant, d'un cran plus loin : on avait vérifié que la fenêtre se déclare,
 * pas qu'elle se comporte comme ce qu'elle déclare.
 *
 * Le comportement vit dans `usePiegeFocus` et nulle part ailleurs. Une fenêtre
 * l'emploie directement, ou passe par `Modale` qui l'emploie pour elle.
 */
describe("ce que promet aria-modal", () => {
  const src = path.join(process.cwd(), "src");
  const modales = fichiersTsx(src)
    .map((f) => ({ chemin: path.relative(src, f), texte: fs.readFileSync(f, "utf8") }))
    .filter(({ chemin, texte }) => /aria-modal/.test(texte)
      // Le hook lui-même parle des fenêtres sans en être une.
      && chemin !== "lib/usePiegeFocus.ts");

  it("trouve bien les fenêtres qui se déclarent modales", () => {
    // Un motif qui cesserait de correspondre rendrait une liste vide, et le
    // test suivant passerait en ne regardant rien.
    expect(modales.length).toBeGreaterThan(3);
    expect(modales.map((m) => m.chemin)).toContain("components/Modale.tsx");
  });

  it("chacune retient le focus, elle-même ou par la Modale commune", () => {
    const sansPiege = modales
      /**
       * Le hook doit être APPELÉ, pas seulement importé.
       *
       * La première version cherchait le nom n'importe où dans le fichier :
       * retirer l'appel de `OnboardingModal` laissait la ligne d'import, donc
       * le test au vert. Un garde qui reconnaît un import reconnaît une
       * intention, pas un comportement — et c'est le comportement qui manquait
       * aux quatre fenêtres.
       */
      .filter(({ texte }) => !/usePiegeFocus\s*\(/.test(texte) && !/<Modale[\s>]/.test(texte))
      .map(({ chemin }) => chemin);
    expect(sansPiege).toEqual([]);
  });

  it("le hook fait bien les trois choses qu'il promet", () => {
    /**
     * Sans ce contrôle, le hook pourrait se vider et les fenêtres continuer de
     * l'appeler : la suite resterait verte en ne gardant plus rien. C'est le
     * même garde que celui du recensement du stockage.
     */
    const hook = fs.readFileSync(path.join(src, "lib", "usePiegeFocus.ts"), "utf8");
    // Le focus entre.
    expect(hook).toMatch(/\.focus\(\)/);
    // Il tourne en rond.
    expect(hook).toMatch(/e\.key !== "Tab"/);
    expect(hook).toMatch(/preventDefault/);
    // Il revient d'où il venait, et pas n'importe où : l'endroit d'où l'on
    // vient se retient HORS de la fenêtre, sans quoi un champ en `autoFocus`
    // se fait capturer à sa place et le focus repart du haut du document.
    expect(hook).toMatch(/activeElement/);
    expect(hook).toMatch(/dernierHorsFenetre/);
    expect(hook).toMatch(/rendreA\?\.isConnected/);
  });
});

/**
 * Une bannière n'est pas une fenêtre, et n'a rien à retenir.
 *
 * `InvitationInstallation` porte `role="dialog"` sans `aria-modal` : c'est une
 * bannière en bas d'écran qui ne recouvre pas la page. Y piéger le focus
 * empêcherait d'atteindre ce qu'on était en train de lire — ce serait un
 * défaut, pas une correction. La distinction n'est pas cosmétique, et c'est
 * elle qui explique pourquoi le recensement ci-dessus porte sur `aria-modal`
 * et non sur `role="dialog"`.
 */
describe("les fenêtres non modales", () => {
  it("ne piègent pas le focus", () => {
    const banniere = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "InvitationInstallation.tsx"), "utf8");
    expect(banniere).toMatch(/role=["']dialog["']/);
    expect(banniere).not.toMatch(/aria-modal/);
    expect(banniere).not.toMatch(/usePiegeFocus/);
  });
});
