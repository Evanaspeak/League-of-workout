import { EXERCICE_IDS } from "@/lib/exercices";
import { exercices } from "@/lib/i18n/dictionaries/exercices";
import { descriptionsExercices, nomsExercices } from "./nomsExercices";

describe("noms des exercices", () => {
  it("nomme chaque exercice du catalogue, dans les six langues", () => {
    // C'est le contrôle qui manquait : un exercice ajouté sans son nom
    // s'affichait « undefined » sur un écran et pas sur les autres.
    for (const [langue, textes] of Object.entries(exercices)) {
      const noms = nomsExercices(textes as Record<string, unknown>);
      const descs = descriptionsExercices(textes as Record<string, unknown>);
      for (const id of EXERCICE_IDS) {
        expect(`${langue}/${id}/nom: ${noms[id]}`).not.toMatch(/: $/);
        expect(`${langue}/${id}/desc: ${descs[id]}`).not.toMatch(/: $/);
      }
    }
  });

  it("rend une chaîne vide plutôt qu'undefined sur un dictionnaire incomplet", () => {
    // Un « undefined » à l'écran ne se comprend pas ; une place vide, si.
    const noms = nomsExercices({});
    for (const id of EXERCICE_IDS) expect(noms[id]).toBe("");
  });
});

describe("deux exercices voisins ne portent jamais le même nom", () => {
  /**
   * Le sac et le shadow sont le cas qui a motivé ce contrôle (réponse 078),
   * et c'est aussi celui qui se recopie le plus facilement : deux entrées du
   * catalogue, un seul geste, et six blocs de langue à remplir. Une traduction
   * qui les nomme pareil rend la séparation invisible — l'écran affiche deux
   * fois « Boxe » et personne ne sait laquelle demande un sac.
   *
   * Le contrôle porte sur TOUT le catalogue plutôt que sur cette paire : le
   * jour où l'on ajoutera les fentes à côté des squats, la question se
   * reposera à l'identique.
   */
  it("dans chacune des six langues", () => {
    const collisions: string[] = [];
    let examines = 0;
    for (const [langue, t] of Object.entries(exercices)) {
      const noms = nomsExercices(t as Record<string, unknown>);
      const vus = new Map<string, string>();
      for (const [id, nom] of Object.entries(noms)) {
        examines += 1;
        const precedent = vus.get(nom);
        if (precedent) collisions.push(`${langue} : ${precedent} et ${id} s'appellent tous deux « ${nom} »`);
        else vus.set(nom, id);
      }
    }
    // Témoin : un catalogue vidé ne rendrait aucune collision non plus.
    expect(examines).toBeGreaterThanOrEqual(6 * 9);
    expect(collisions).toEqual([]);
  });
});
