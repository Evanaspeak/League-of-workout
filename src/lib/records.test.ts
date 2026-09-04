import { composerRecords, type JourPaye } from "@/lib/records";

const pseudos = new Map([["moi", "Moi"], ["ami", "Ami"], ["autre", "Autre"]]);
const j = (userId: string, jour: string, points: number): JourPaye => ({ userId, jour, points });

describe("le mur des records", () => {
  it("retient le plus gros JOUR, et pas la plus grosse somme", () => {
    /**
     * C'est ce qui le distingue du classement, juste au-dessus : celui-ci
     * additionne la semaine, celui-là prend une pointe. Ami paie plus au
     * total, Moi a fait la plus grosse soirée.
     */
    const r = composerRecords([
      j("moi", "2026-09-02", 400),
      j("ami", "2026-09-01", 300),
      j("ami", "2026-09-02", 300),
      j("ami", "2026-09-03", 300),
    ], pseudos, "moi", "2026-09");
    expect(r.toujours).toMatchObject({ pseudo: "Moi", points: 400, jour: "2026-09-02", moi: true });
  });

  it("sépare le mois du cumul de toujours", () => {
    const r = composerRecords([
      j("ami", "2026-07-14", 900),
      j("moi", "2026-09-02", 120),
    ], pseudos, "moi", "2026-09");
    expect(r.toujours?.points).toBe(900);
    expect(r.mois?.points).toBe(120);
    expect(r.mois?.pseudo).toBe("Moi");
  });

  it("à égalité, le plus ANCIEN tient", () => {
    // Un record ne se prend pas en égalant. Sans cette règle, le titre
    // changerait de main à chaque soirée où quelqu'un refait le même chiffre.
    const r = composerRecords([
      j("ami", "2026-09-01", 500),
      j("moi", "2026-09-05", 500),
    ], pseudos, "moi", "2026-09");
    expect(r.toujours).toMatchObject({ pseudo: "Ami", jour: "2026-09-01" });
  });

  it("écarte qui n'est pas dans le cercle", () => {
    /**
     * Le filtre est la liste des pseudos, qui vient déjà filtrée du mode
     * fantôme : quelqu'un qui s'est retiré des classements n'apparaît pas
     * davantage ici. Sans ce contrôle, un inconnu prendrait le mur.
     */
    const r = composerRecords([
      j("inconnu", "2026-09-01", 9000),
      j("moi", "2026-09-02", 40),
    ], pseudos, "moi", "2026-09");
    expect(r.toujours).toMatchObject({ pseudo: "Moi", points: 40 });
  });

  it("rend null plutôt qu'une ligne vide quand personne n'a rien payé", () => {
    expect(composerRecords([], pseudos, "moi", "2026-09"))
      .toEqual({ mois: null, toujours: null });
    // Un jour à zéro n'est pas un record : personne n'a rien fait.
    expect(composerRecords([j("moi", "2026-09-02", 0)], pseudos, "moi", "2026-09").toujours)
      .toBeNull();
  });

  it("écarte ce qui n'est pas un nombre", () => {
    const r = composerRecords([
      j("moi", "2026-09-02", Number.NaN),
      j("ami", "2026-09-03", 10),
    ], pseudos, "moi", "2026-09");
    expect(r.toujours).toMatchObject({ pseudo: "Ami", points: 10 });
  });

  it("sans mois lisible, le record du mois n'est pas inventé", () => {
    const r = composerRecords([j("moi", "2026-09-02", 40)], pseudos, "moi", null);
    expect(r.mois).toBeNull();
    expect(r.toujours?.points).toBe(40);
  });
});
