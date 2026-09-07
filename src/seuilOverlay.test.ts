import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "@/test/sansCommentaires";
import { reponseDette } from "@/lib/contexteConnecte";
import { seuilFranchi } from "@/lib/compteurDette";

/**
 * La pastille en jeu passe au rouge quand le seuil de rappel est franchi
 * (ligne 165 du plan, réponse « Oui »).
 *
 * **Ce garde est statique, et il n'y a pas d'autre choix.** La pastille est une
 * fenêtre Electron : aucun parcours navigateur ne peut l'ouvrir, et les
 * parcours qui simulent le pont posent un faux `window.electronLOL` — ils
 * éprouveraient donc la doublure. C'est la situation déjà écrite pour la
 * vibration, et la réponse est la même : lire les deux moitiés à la source.
 *
 * **Et il vérifie un BRANCHEMENT, pas un mot.** La leçon de la nuit du
 * 7 septembre est que l'identifiant survit à presque tout sabotage — une ligne
 * d'import, un commentaire, une branche morte le laissent en place. Ce qui ne
 * survit pas : l'APPEL, l'INJECTION dans le passage obligé, et la RÈGLE CSS
 * qui donne une couleur à la classe qu'on bascule.
 *
 * Le pire défaut possible ici est silencieux : une classe basculée qui
 * n'existe pas dans la feuille de style ne colore rien, ne lève rien, et ne se
 * verrait que sur la machine de quelqu'un, en jeu.
 */
const RACINE = join(__dirname, "..");
const PAGE = sansCommentaires(
  readFileSync(join(RACINE, "src/components/DetteDirecte.tsx"), "utf8"),
);
const PASTILLE = readFileSync(join(RACINE, "desktop/src/overlay.html"), "utf8");

describe("ce que la route rend nourrit vraiment la règle", () => {
  /**
   * Le joint qui casserait en silence.
   *
   * `DetteDirecte` passe la réponse BRUTE de `/api/dette` à `seuilFranchi`,
   * qui lit `dureeSec` et `seuilSec`. Une colonne renommée d'un côté rendrait
   * `undefined` de l'autre, donc « pas franchi » pour toujours — sans erreur,
   * sans test rouge, et sans que la pastille ne rougisse jamais. Les deux
   * modules ne se connaissent pas ; c'est ce test qui les tient ensemble.
   */
  const compte = (dus: number, seuil: number) => ({
    dettePointsDus: dus, rappelSeuilSec: seuil, exercices: ["boxe"],
  });

  it("franchit quand la dette atteint le seuil réglé", () => {
    const dette = reponseDette(compte(200, 60));
    expect(dette.dureeSec).toBeGreaterThanOrEqual(dette.seuilSec);
    expect(seuilFranchi(dette)).toBe(true);
  });

  it("ne franchit pas en dessous", () => {
    expect(seuilFranchi(reponseDette(compte(10, 3600)))).toBe(false);
  });

  it("et jamais quand aucun seuil n'est réglé", () => {
    // Zéro veut dire « pas de seuil » et non « préviens tout de suite » : sans
    // cette distinction, la pastille de quelqu'un qui n'a rien réglé serait
    // rouge en permanence, donc muette.
    expect(seuilFranchi(reponseDette(compte(9000, 0)))).toBe(false);
  });
});

describe("la page décide du seuil", () => {
  it("le lit avec la MÊME fonction que la pastille du site", () => {
    // Pas une seconde règle : deux écritures de ce seuil ont déjà produit deux
    // nombres qui se contredisaient à l'écran, et le journal en porte l'entrée.
    expect(PAGE).toMatch(/seuilRef\.current\s*=\s*seuilFranchi\s*\(/);
  });

  it("le pose dans le passage obligé, pas chez les appelants", () => {
    // Une règle écrite à cinq endroits finit appliquée à quatre. Le contrôle
    // porte donc sur l'INJECTION dans `publier`, pas sur sa présence quelque
    // part dans le fichier.
    expect(PAGE).toMatch(/publierDette\?\.\([\s\S]{0,160}seuil:\s*seuilRef\.current/);
  });

  it("et aucun appelant ne le construit lui-même", () => {
    // Sinon on retomberait exactement dans le motif qu'on vient d'éviter : le
    // seuil juste à quatre endroits sur cinq, et faux au cinquième.
    const appels = [...PAGE.matchAll(/\bpublier\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
    expect(appels.length).toBeGreaterThanOrEqual(4);
    for (const appel of appels) expect(appel).not.toMatch(/\bseuil\b/);
  });
});

describe("la pastille montre le seuil", () => {
  /** La classe réellement basculée par la pastille, quelle qu'elle soit. */
  const bascule = PASTILLE.match(
    /classList\.toggle\(\s*"([^"]+)"\s*,\s*([^)]*)\)/,
  );

  it("bascule une classe à partir de ce que la page publie", () => {
    expect(bascule).not.toBeNull();
    // Le second argument doit venir de la charge utile. Une constante ferait
    // une pastille toujours rouge ou jamais rouge, sans que rien ne le dise.
    expect(bascule![2]).toMatch(/\bseuil\b/);
    expect(bascule![2]).not.toMatch(/^\s*(true|false)\s*$/);
  });

  it("et cette classe-là a bien une couleur dans la feuille de style", () => {
    // Le défaut silencieux de cette famille : basculer une classe qui n'existe
    // pas. Rien ne lève, rien ne colore, et ça ne se voit qu'en jeu.
    const classe = bascule![1];
    const regle = new RegExp(`\\.${classe}\\s*\\{[^}]*color\\s*:`);
    expect(PASTILLE).toMatch(regle);
  });

  it("sans écraser la couleur ordinaire de la dette", () => {
    // L'orange dit « il y a quelque chose », le rouge « il y a de quoi faire
    // une séance ». Perdre le premier rendrait le second muet.
    expect(PASTILLE).toMatch(/\.ligne b\.dette\s*\{[^}]*color\s*:/);
  });
});
