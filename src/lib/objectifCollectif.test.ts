import { CIBLE_COLLECTIVE, composerCollectif } from "@/lib/objectifCollectif";

describe("l'objectif collectif", () => {
  it("rend la part entre 0 et 1, bornée en haut", () => {
    // Dépasser l'objectif est un cas légitime ; une barre qui déborde de son
    // cadre ne l'est pas.
    expect(composerCollectif({ points: 0, contributeurs: 0 }).part).toBe(0);
    expect(composerCollectif({ points: CIBLE_COLLECTIVE * 3, contributeurs: 9 }).part).toBe(1);
    expect(composerCollectif({ points: CIBLE_COLLECTIVE / 2, contributeurs: 4 }).part).toBe(0.5);
  });

  it("est atteint AU seuil", () => {
    expect(composerCollectif({ points: CIBLE_COLLECTIVE - 1, contributeurs: 4 }).atteint).toBe(false);
    expect(composerCollectif({ points: CIBLE_COLLECTIVE, contributeurs: 4 }).atteint).toBe(true);
  });

  it("porte TOUJOURS le nombre de contributeurs", () => {
    /**
     * Ce n'est pas une décoration : « 8 420 sur 100 000 » est décourageant à
     * quatre, « 8 420 sur 100 000, à 4 » est vrai à toutes les tailles. Le
     * retirer rendrait la barre triste sans la rendre plus juste.
     */
    const c = composerCollectif({ points: 8420, contributeurs: 4 });
    expect(c.contributeurs).toBe(4);
    expect(c.points).toBe(8420);
    expect(c.cible).toBe(CIBLE_COLLECTIVE);
  });

  it("écarte ce qui n'est pas un nombre plutôt que de rendre NaN", () => {
    // NaN traverse une barre de progression sans bruit, et une largeur
    // « NaN% » ne dessine rien du tout.
    const c = composerCollectif({ points: Number.NaN, contributeurs: Number.NaN });
    expect(c).toMatchObject({ points: 0, contributeurs: 0, part: 0, atteint: false });
    expect(composerCollectif({ points: -50, contributeurs: -1 }).points).toBe(0);
  });
});
