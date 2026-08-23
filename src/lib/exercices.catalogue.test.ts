import {
  EXERCICES, EXERCICE_IDS, EXERCICES_REGLABLES, RATIO_BORNES, RATIOS_DEFAUT,
  dureeEffort, formaterCompact, quantite,
} from "./exercices";

/**
 * Le catalogue lui-même.
 *
 * Ces contrôles ne portent pas sur une fonction mais sur des VALEURS : un
 * exercice ajouté avec un ratio de travers ne casse rien, il rend simplement
 * une dette absurde. C'est le genre de défaut qu'on ne voit qu'en le payant.
 */
describe("catalogue", () => {
  it("décrit complètement chaque exercice", () => {
    for (const id of EXERCICE_IDS) {
      const d = EXERCICES[id];
      expect(d.id).toBe(id);
      expect(d.ratio).toBeGreaterThan(0);
      expect(d.pas).toBeGreaterThan(0);
      expect(["haut", "bas", "tronc", "cardio"]).toContain(d.groupe);
      expect(typeof d.materiel).toBe("boolean");
      // Un exercice compté en répétitions ou en distance doit dire combien de
      // temps une unité demande : sans ça, sa dette ne se compare à aucune
      // autre et `dureeEffort` rend zéro.
      if (d.unite !== "temps") expect(d.secondesParRep).toBeGreaterThan(0);
    }
  });

  it("garde un ratio par défaut dans ses propres bornes", () => {
    // Une valeur livrée hors bornes serait refusée à la première sauvegarde de
    // l'administration, sans que personne comprenne pourquoi.
    for (const id of EXERCICE_IDS) {
      const { min, max } = RATIO_BORNES[id];
      expect(RATIOS_DEFAUT[id]).toBeGreaterThanOrEqual(min);
      expect(RATIOS_DEFAUT[id]).toBeLessThanOrEqual(max);
    }
  });

  it("laisse les pompes fixes, et rend les autres réglables", () => {
    // Le point d'effort EST la pompe : bouger ce ratio relirait tout
    // l'historique dans une autre unité.
    expect(EXERCICES_REGLABLES).not.toContain("pompes");
    expect(RATIO_BORNES.pompes).toEqual({ min: 1, max: 1 });
    for (const id of EXERCICE_IDS) {
      if (id !== "pompes") expect(EXERCICES_REGLABLES).toContain(id);
    }
  });

  it("demande entre cinq et vingt minutes d'effort pour cent points", () => {
    /**
     * C'est la seule comparaison qui vaille entre des répétitions, des
     * secondes et des kilomètres : le temps qu'il faut pour s'en acquitter.
     * Un exercice deux fois plus rapide que les autres deviendrait le seul
     * choix rationnel, et un exercice trois fois plus long ne serait jamais
     * choisi.
     */
    for (const id of EXERCICE_IDS) {
      const minutes = dureeEffort(100, [id]) / 60;
      expect(`${id}: ${Math.round(minutes)} min`).toMatch(/^\w+: (?:[5-9]|1[0-9]|20) min$/);
    }
  });

  it("rend une quantité lisible, sans flottant qui traîne", () => {
    // Trois fois 0,1 vaut 0,30000000000000004 : une distance s'afficherait
    // ainsi, et c'est le genre de détail qui décrédibilise tout l'écran.
    for (const id of EXERCICE_IDS) {
      for (const points of [1, 7, 13, 100, 137]) {
        expect(String(quantite(points, id))).not.toMatch(/\d{6,}/);
        expect(formaterCompact(points, id)).not.toMatch(/\d{6,}/);
      }
    }
  });

  it("nomme son unité quand elle n'est pas une répétition", () => {
    // « 2,4 » seul ne dit pas des kilomètres.
    expect(formaterCompact(100, "course")).toMatch(/km$/);
    expect(formaterCompact(100, "planche")).toMatch(/min|s$/);
    expect(formaterCompact(100, "pompes")).toBe("100");
  });
});
