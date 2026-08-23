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
