import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Le module de vibration est juste, et ça ne sert à rien si personne ne
 * l'appelle.
 *
 * C'est le trou que ce projet paie en boucle, et il est écrit six fois au
 * journal : `formaterDuree` débranché de ses appelants, `formaterAxe` juste et
 * jamais lu, `nomPublie` reconnu par sa ligne d'import. Ici il est encore plus
 * facile à creuser : une vibration qui ne part pas ne casse RIEN — pas une
 * erreur, pas un écran vide, rien. On appuie sur le plus, ça compte, et
 * personne ne sait que l'option ne fait plus rien.
 *
 * Aucun parcours navigateur ne peut le voir non plus : `navigator.vibrate`
 * n'existe pas dans le Chromium de la suite, et poser une fausse méthode
 * éprouverait la fausse méthode. Le garde est donc STATIQUE, et il regarde
 * les deux moitiés : le geste qui vibre, et l'écran qui l'allume.
 */

const SRC = join(process.cwd(), "src");
const lire = (...p: string[]) => sansCommentaires(readFileSync(join(SRC, ...p), "utf8"));

/** Ce qui suit un `aria-label={t.<cle>}`, jusqu'à la fermeture du bouton. */
function bouton(source: string, cle: string): string {
  const i = source.indexOf(`aria-label={t.${cle}}`);
  expect(i).toBeGreaterThan(-1);
  const fin = source.indexOf("</button>", i);
  expect(fin).toBeGreaterThan(i);
  return source.slice(i, fin);
}

describe("la vibration est branchée là où l'on compte", () => {
  const compteur = lire("components", "CompteurDette.tsx");

  it("le PLUS vibre", () => {
    expect(compteur).toContain('from "@/lib/vibration"');
    expect(bouton(compteur, "detteAjouterUn")).toMatch(/vibrerRepetition\s*\(/);
  });

  it("et le moins NON", () => {
    /**
     * Ce n'est pas une omission, c'est la décision. Une répétition comptée est
     * un geste qu'on fait sans regarder l'écran ; le moins est une CORRECTION,
     * et la confirmer par la même impulsion effacerait la distinction. Sans ce
     * contrôle, « vibrer partout » passerait pour la même chose.
     */
    expect(bouton(compteur, "detteRetirerUn")).not.toMatch(/vibrerRepetition\s*\(/);
  });

  it("et la saisie au clavier non plus", () => {
    // Taper « 40 » n'est pas quarante répétitions : ce serait une vibration
    // par frappe, sur un champ où l'on corrige.
    const i = compteur.indexOf("aria-label={t.detteFaitsLabel}");
    expect(i).toBeGreaterThan(-1);
    expect(compteur.slice(i, i + 600)).not.toMatch(/vibrerRepetition\s*\(/);
  });
});

describe("et le réglage est atteignable", () => {
  it("l'écran des réglages monte le panneau", () => {
    /**
     * Le composant peut exister, être juste, et n'être monté nulle part : le
     * journal porte le cas d'un module dont le seul lecteur était son propre
     * test. On exige donc l'IMPORT et le RENDU, pas l'un des deux.
     */
    const page = lire("app", "[locale]", "settings", "page.tsx");
    expect(page).toMatch(/import \{ ReglageVibration \}/);
    expect(page).toMatch(/<ReglageVibration\s*\/>/);
  });

  it("le panneau écrit le choix et demande à l'appareil ce qu'il sait faire", () => {
    const panneau = lire("app", "[locale]", "settings", "ReglageVibration.tsx");
    // Sans l'écriture, le réglage ne se retient pas et l'écran ment.
    expect(panneau).toMatch(/poserVibration\s*\(/);
    /**
     * Et sans la question à l'appareil, on propose une option qui ne fera
     * jamais rien à la moitié des téléphones — Safari sur iPhone n'implémente
     * pas l'API. L'écran DIT ce que l'appareil ne sait pas faire plutôt que de
     * cacher la case : c'est la règle posée pour « Tes jeux » hors
     * application, et elle est portée par une clé de dictionnaire.
     */
    expect(panneau).toMatch(/vibrationDisponible\s*\(/);
    expect(panneau).toMatch(/vibrationIndisponible/);
  });
});
