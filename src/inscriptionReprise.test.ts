import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * L'inscription se remplit avec REPRISE, partout, ou pas du tout.
 *
 * Le bouton d'inscription vaut `disabled={pseudo.trim().length < 2 || loading}` :
 * il dépend de l'ÉTAT React, pas du DOM. Une saisie qui arrive avant que React
 * n'écoute n'atteint donc aucun état, le champ contrôlé se remet à vide au
 * rendu suivant, et le bouton reste désactivé POUR TOUJOURS — il n'y a aucun
 * second `fill` pour le réveiller.
 *
 * **Ce n'est pas une hypothèse : c'est la CI de V581.** Le travail `bareme`
 * est tombé sur `bareme-gele.spec.ts`, avec cent onze reprises de clic sur
 * `<button disabled>Obtenir mon code</button>`, et une minute de délai pour un
 * test qui met sept secondes. Les huit tronçons de parcours étaient verts : le
 * défaut est une COURSE, il ne tombe que sur la machine qui perd.
 *
 * La reprise vivait dans `ouvrirCompte` depuis des semaines. **Dix des onze
 * fichiers qui remplissent le formulaire à la main ne l'avaient pas**, et le
 * commentaire d'`ouvrirCompte` écrivait noir sur blanc pourquoi ils n'avaient
 * pas été convertis : « le défaut qui aurait justifié d'y toucher n'existait
 * pas ». C'est le motif que ce journal reproche partout — une règle écrite
 * deux fois finit avec une version en retard — et la version en retard était
 * celle de dix fichiers sur onze.
 *
 * Le garde ne demande pas d'appeler `ouvrirCompte` : plusieurs de ces fichiers
 * ont besoin de GARDER leur page et leur contexte, quand `ouvrirCompte` rend
 * un état de session. Il demande que la SAISIE passe par la fonction
 * partagée, ce qui est la seule chose qu'ils avaient tous en commun.
 */

const E2E = join(__dirname, "..", "e2e");

/** Ce qui remplit le champ de pseudo de l'inscription, quelle que soit la forme. */
const SAISIE = /getByPlaceholder\(\/pseudo\/i\)/;

function fichiers(): string[] {
  return readdirSync(E2E).filter((f) => f.endsWith(".ts"));
}

/**
 * Le source privé de ses commentaires.
 *
 * Sans ça, le garde tombe sur sa propre explication : ce fichier-ci et le
 * commentaire de `compte.ts` citent tous deux le motif fautif pour dire
 * pourquoi il a disparu. C'est le piège déjà payé quatre fois dans ce dépôt.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

describe("la saisie de l'inscription", () => {
  const sources = fichiers().map((f) => [f, sansCommentaires(readFileSync(join(E2E, f), "utf8"))] as const);

  it("passe par la fonction partagée, et par elle seule", () => {
    const fautifs = sources
      // `compte.ts` PORTE la reprise : c'est le seul endroit où le champ se
      // remplit en clair, et l'y interdire reviendrait à interdire la règle.
      .filter(([f]) => f !== "compte.ts")
      .filter(([, s]) => SAISIE.test(s))
      .map(([f]) => f);
    expect(fautifs).toEqual([]);
  });

  it("la fonction partagée reprend vraiment tant que le bouton est éteint", () => {
    const s = sansCommentaires(readFileSync(join(E2E, "compte.ts"), "utf8"));
    const bloc = /export async function remplirInscription\([\s\S]*?\n\}/.exec(s);
    expect(bloc).not.toBeNull();
    const corps = bloc![0];
    // Les trois moitiés, et il faut les trois : reprendre, remplir DANS la
    // reprise, et s'arrêter sur l'état RÉEL du bouton. Une reprise qui ne
    // refait pas le `fill` ne réveille rien ; un `fill` sans reprise est le
    // défaut d'origine ; et attendre autre chose que `isEnabled` rendrait la
    // main sur un bouton toujours éteint.
    expect(corps).toMatch(/expect\.poll/);
    expect(corps).toMatch(/isEnabled\(\)/);
    /**
     * Et c'est le PSEUDO qu'il faut refaire, pas n'importe quel champ.
     *
     * Ma première version exigeait un `.fill(` quelconque dans le corps. Le
     * sabotage l'a dit : retirer la ligne du pseudo laisse celle de l'e-mail,
     * donc le contrôle passe au vert — alors que `disabled` ne dépend QUE de
     * `pseudo.trim().length`. Le champ qui réveille le bouton est nommé.
     */
    const boucle = /expect\.poll\(async \(\) => \{([\s\S]*?)\n {2}\}/.exec(corps);
    expect(boucle).not.toBeNull();
    expect(boucle![1]).toMatch(/getByPlaceholder\(\/pseudo\/i\)/);
  });

  it("repose le champ au lieu de le remplir par-dessus", () => {
    /**
     * Le contrôle qui compte, et il a manqué à ma première correction.
     *
     * `fill` ne fait RIEN quand la valeur est déjà la bonne : pas de
     * changement, pas d'événement, pas d'état. Une reprise qui se contente de
     * refaire le `fill` tourne donc trente secondes et rend le même écran —
     * c'est ce que `ouvrirCompte` faisait depuis des semaines, et c'est ce
     * qui a laissé V581 partir rouge.
     *
     * Mesuré sur la course rendue déterministe (fragments retardés de deux
     * secondes, saisie posée avant l'hydratation) :
     *
     * | reprise            | bouton après trente secondes |
     * |--------------------|------------------------------|
     * | `fill` répété      | **éteint**                   |
     * | vider puis remplir | actif                        |
     *
     * Un garde qui n'exigerait que la boucle accepterait donc la version qui
     * ne répare rien.
     */
    const s = sansCommentaires(readFileSync(join(E2E, "compte.ts"), "utf8"));
    const reposer = /(?:async )?function reposer\([\s\S]*?\n\}/.exec(s);
    expect(reposer).not.toBeNull();
    expect(reposer![0]).toMatch(/\.fill\(""\)/);
    // Et les deux formulaires doivent PASSER par elle : la connexion porte le
    // même motif, et sa condition d'avant l'empêchait plus sûrement encore.
    expect((s.match(/\breposer\(/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("le recensement a réellement lu les parcours", () => {
    // Sans témoin, un dossier renommé ou une extension qui change rendrait
    // les deux contrôles verts en n'ouvrant aucun fichier.
    expect(sources.length).toBeGreaterThan(20);
    // Et il doit rester des fichiers qui INSCRIVENT : sinon le premier
    // contrôle est vide, et son silence ne voudrait rien dire.
    const inscrivent = sources.filter(([, s]) => /remplirInscription\s*\(/.test(s));
    expect(inscrivent.length).toBeGreaterThanOrEqual(10);
    /**
     * Le témoin du MOTIF, distinct de celui du recensement.
     *
     * Sabotage fait : `SAISIE` vidée de son objet laisse les deux contrôles
     * verts — zéro fautif, et le compte d'appels ne la regarde pas. L'état
     * sain est zéro trouvaille HORS de `compte.ts`, mais `compte.ts` en porte
     * une par construction : c'est elle qui prouve que le motif voit encore.
     */
    expect(sources.filter(([, s]) => SAISIE.test(s)).map(([f]) => f)).toEqual(["compte.ts"]);
  });
});
