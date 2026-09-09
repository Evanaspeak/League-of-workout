import { RUBRIQUES, versRubrique } from "./ListeReglages";

/**
 * L'adresse d'une rubrique de réglages.
 *
 * `useRubrique` lit `window.location.hash` : la rubrique ouverte vit dans le
 * FRAGMENT. Les deux premières étapes des « Premiers pas » visaient
 * `?rubrique=effort` — un paramètre que personne ne lit — donc elles arrivaient
 * sur la liste des rubriques, et il fallait trouver « Ton effort » soi-même.
 *
 * Le TYPE attrape un identifiant inventé ou renommé ; il ne dit rien du retour
 * au paramètre de requête, qui compile parfaitement et n'ouvre rien. C'est
 * exactement ce trou-là que ce fichier bouche.
 */
describe("l'adresse d'une rubrique de réglages", () => {
  it("porte l'identifiant dans le FRAGMENT et pas dans la requête", () => {
    expect(versRubrique("effort")).toBe("/settings#effort");
    expect(versRubrique("jeux")).toBe("/settings#jeux");
  });

  it("vaut pour toutes les rubriques, y compris celles qu'on ajoutera", () => {
    // Sans ce tour, le contrôle ne parlerait que des deux rubriques que les
    // « Premiers pas » désignent aujourd'hui.
    for (const id of RUBRIQUES) {
      expect(versRubrique(id)).toBe(`/settings#${id}`);
      expect(versRubrique(id)).not.toMatch(/[?&]/);
    }
    expect(RUBRIQUES.length).toBeGreaterThanOrEqual(5);
  });
});
