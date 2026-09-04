import {
  defisAAcquitter, XP_DEFI_JOUR, XP_DEFI_MOIS,
} from "./xpDefis";

describe("les défis à retenir", () => {
  const fait = (cle: string) => ({ cle, fait: true });
  const pasFait = (cle: string) => ({ cle, fait: false });

  it("ne retient rien tant que rien n'est rempli", () => {
    expect(defisAAcquitter("2026-09-04", "2026-09", pasFait("parties3"), [pasFait("moisVolume")]))
      .toEqual([]);
  });

  it("retient le défi du jour sur le JOUR, et celui du mois sur le MOIS", () => {
    /**
     * C'est la période qui rend l'écriture idempotente : un défi du jour se
     * regagne demain, un défi du mois le mois prochain, mais aucun deux fois
     * dans la même période. Sans elle, chaque chargement de page écrirait une
     * ligne de plus et l'XP monterait toute seule.
     */
    expect(defisAAcquitter("2026-09-04", "2026-09", fait("parties3"), [fait("moisVolume")]))
      .toEqual([
        { cle: "parties3", periode: "2026-09-04", xp: XP_DEFI_JOUR },
        { cle: "moisVolume", periode: "2026-09", xp: XP_DEFI_MOIS },
      ]);
  });

  it("retient les deux défis du mois séparément", () => {
    const lignes = defisAAcquitter("2026-09-04", "2026-09", null,
      [fait("moisVolume"), fait("moisParties")]);
    expect(lignes.map((l) => l.cle)).toEqual(["moisVolume", "moisParties"]);
    expect(lignes.every((l) => l.periode === "2026-09")).toBe(true);
  });

  it("ne retient que ce qui est rempli, dans un lot mixte", () => {
    const lignes = defisAAcquitter("2026-09-04", "2026-09", pasFait("parties3"),
      [fait("moisVolume"), pasFait("moisParties")]);
    expect(lignes).toEqual([{ cle: "moisVolume", periode: "2026-09", xp: XP_DEFI_MOIS }]);
  });

  it("écarte un défi dont la période est vide", () => {
    /**
     * Une période vide écrirait une ligne qu'aucune requête ne retrouverait —
     * l'XP serait comptée mais introuvable, et personne ne saurait pourquoi.
     * C'est la famille du mois « 2026-13 », qui a la forme d'une date sans en
     * être une, et qui a déjà coûté un défaut sur ce projet.
     */
    expect(defisAAcquitter("", "", fait("parties3"), [fait("moisVolume")])).toEqual([]);
  });

  it("donne plus à un défi du mois qu'à un défi du jour", () => {
    // Un mois demande trente fois plus de travail qu'une journée : l'inverse
    // ferait remplir les défis mensuels sans jamais les regarder.
    expect(XP_DEFI_MOIS).toBeGreaterThan(XP_DEFI_JOUR);
  });
});
