import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROLES, ROLES_DEFAUT } from "@/lib/scoringDefaut";

/**
 * Les rôles proposés à l'écran sont ceux que le barème connaît.
 *
 * `/api/games` rend « Rôle inconnu » quand le rôle envoyé n'a pas de ligne
 * dans `RoleWeight`. Un écran qui en proposerait un absent ferait donc refuser
 * une saisie parfaitement conforme à ce qu'il venait de demander — et le
 * message accuserait la personne. C'est le défaut du champion refusé, une
 * table plus loin.
 *
 * La liste était écrite TROIS fois à la main : le formulaire d'ajout, le
 * simulateur de dette et le filtre de l'historique. Les trois coïncidaient, ce
 * qui est le cas normal — une duplication ne se remarque jamais tant qu'elle
 * n'a pas divergé, et c'est ce qui la rend chère. Elles lisent maintenant
 * `ROLES`, qui se déduit du barème.
 *
 * Ce test garde ce que l'import ne peut pas garder : qu'aucune des trois ne
 * revienne à sa liste en dur. Un composant qui réécrirait les sept noms
 * compilerait parfaitement.
 */

const ECRANS = [
  join("src", "components", "AjoutActivite.tsx"),
  join("src", "components", "SimulateurDette.tsx"),
  join("src", "app", "[locale]", "history", "Historique.tsx"),
];

function source(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}

describe("les rôles ne sont écrits qu'une fois", () => {
  it("le barème en donne bien sept, et la liste dérivée les reprend", () => {
    // Le témoin. Sans lui, un barème vidé rendrait les contrôles suivants
    // verts en ne comparant plus rien.
    expect(ROLES_DEFAUT.length).toBeGreaterThanOrEqual(5);
    expect(ROLES).toEqual(ROLES_DEFAUT.map((r) => r.role));
  });

  it("aucun écran ne réécrit la liste en dur", () => {
    /**
     * Le motif cherche DEUX rôles voisins entre guillemets : c'est la forme
     * qu'une liste réécrite prend forcément, et c'est ce qui la distingue d'un
     * nom de rôle mentionné seul — la valeur par défaut mémorisée du
     * formulaire, par exemple, qui est légitime.
     */
    const noms = ROLES.map((r) => `"${r}"`);
    const fautifs = ECRANS.filter((f) => {
      const texte = source(f);
      const voisins = noms.filter((n, i) => i > 0 && texte.includes(`${noms[i - 1]}, ${n}`));
      return voisins.length > 0;
    });
    expect(fautifs).toEqual([]);
  });

  it("les trois écrans lisent bien la source", () => {
    // Sans ce contrôle, retirer la liste sans la remplacer passerait : le test
    // précédent est un refus, pas une exigence.
    const muets = ECRANS.filter((f) => !/\bROLES\b/.test(source(f)));
    expect(muets).toEqual([]);
  });

  it("chaque écran désigne un fichier qui existe", () => {
    // Un chemin qui ne mène plus nulle part rendrait les deux contrôles
    // ci-dessus verts sur zéro fichier lu — ici il lève, ce qui est le bon
    // bruit.
    expect(() => ECRANS.forEach(source)).not.toThrow();
  });
});
