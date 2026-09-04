import { defis } from "@/lib/i18n/dictionaries/defis";
import { LANGUES } from "@/lib/i18n/langues";
import {
  avancementMensuel, debutDuMois, DEFIS_MENSUELS, defisDuMois, moisDuJour,
  type SourceMois,
} from "@/lib/defiMensuel";

const rien: SourceMois = { pointsPayesDuMois: 0, partiesDuMois: 0 };
const parCle = (cle: string) => DEFIS_MENSUELS.find((d) => d.cle === cle)!;

describe("le mois d'un jour", () => {
  it("se lit sur le préfixe, et refuse ce qui n'est pas une date", () => {
    expect(moisDuJour("2026-09-04")).toBe("2026-09");
    for (const faux of ["", "2026-09", "pas un jour", "20260904"]) {
      expect(moisDuJour(faux)).toBeNull();
    }
  });

  it("refuse un mois qui n'existe pas, même à la bonne FORME", () => {
    /**
     * « 2026-13-01 » et « 2026-00-01 » ont la forme et pas le sens. Un préfixe
     * faux ne ferait tomber aucune requête — il ne compterait simplement
     * jamais aucun paiement, et l'objectif du mois resterait à zéro pour
     * toujours sans que rien ne le dise.
     */
    expect(moisDuJour("2026-13-01")).toBeNull();
    expect(moisDuJour("2026-00-01")).toBeNull();
  });

  it("borne le début du mois, et rend null sur ce qui n'en est pas un", () => {
    expect(debutDuMois("2026-09-30")?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(debutDuMois("2026-13-01")).toBeNull();
  });
});

describe("les deux défis du mois", () => {
  it("il y en a bien DEUX, un de volume et un de parties", () => {
    // La réponse dit « en volume ET en nombre de parties » : un seul des deux
    // ne serait pas la moitié de la ligne, ce serait une autre ligne.
    expect(DEFIS_MENSUELS).toHaveLength(2);
    expect(DEFIS_MENSUELS.map((d) => d.mesure).sort()).toEqual(["parties", "points"]);
  });

  it("chacun lit SA mesure, et pas celle de l'autre", () => {
    const source = { pointsPayesDuMois: 5000, partiesDuMois: 0 };
    expect(avancementMensuel(parCle("moisPoints"), source).fait).toBe(true);
    expect(avancementMensuel(parCle("moisParties"), source).fait).toBe(false);
  });

  it("est atteint AU seuil", () => {
    const p = parCle("moisPoints");
    expect(avancementMensuel(p, { ...rien, pointsPayesDuMois: p.cible - 1 }).fait).toBe(false);
    expect(avancementMensuel(p, { ...rien, pointsPayesDuMois: p.cible }).fait).toBe(true);
  });

  it("borne l'avancement à la cible et écarte ce qui n'est pas un nombre", () => {
    const p = parCle("moisPoints");
    expect(avancementMensuel(p, { ...rien, pointsPayesDuMois: 1e9 }).ou).toBe(p.cible);
    expect(avancementMensuel(p, { ...rien, pointsPayesDuMois: Number.NaN }))
      .toMatchObject({ ou: 0, fait: false });
    expect(avancementMensuel(p, { ...rien, pointsPayesDuMois: -500 }).ou).toBe(0);
  });

  it("aucun ne se remplit sans avoir rien fait", () => {
    expect(defisDuMois(rien).every((d) => !d.fait)).toBe(true);
    expect(defisDuMois(rien).map((d) => d.cle)).toEqual(DEFIS_MENSUELS.map((d) => d.cle));
  });
});

describe("les libellés du mois", () => {
  /**
   * Même famille que le défi du jour : le libellé se lit par la CLÉ, donc le
   * recensement des clés mortes ne peut pas garantir qu'elle existe, et une
   * clé absente écrirait « undefined » sur le tableau de bord.
   */
  it("chaque défi mensuel a une phrase dans les six langues, qui place sa cible", () => {
    const manquants: string[] = [];
    for (const langue of LANGUES) {
      const table = (defis as unknown as Record<string, Record<string, (n: number) => string>>)[langue];
      for (const d of DEFIS_MENSUELS) {
        if (typeof table[d.cle] !== "function") { manquants.push(`${langue}.${d.cle}`); continue; }
        expect(table[d.cle](d.cible)).toContain(String(d.cible));
      }
    }
    expect(manquants).toEqual([]);
    expect(LANGUES.length * DEFIS_MENSUELS.length).toBeGreaterThanOrEqual(12);
  });
});
