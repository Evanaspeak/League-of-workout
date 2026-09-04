import { defis } from "@/lib/i18n/dictionaries/defis";
import { LANGUES } from "@/lib/i18n/langues";
import {
  avancementDefi, DECALAGE_FIN, defiDuJour, DEFIS, EPOQUE, rangDuJour, type SourceDefi,
} from "@/lib/defiQuotidien";

const rien: SourceDefi = {
  partiesDuJour: 0, victoiresDuJour: 0, jeuxDuJour: 0,
  pointsPayesDuJour: 0, seancesDuJour: 0,
};

/** Les jours d'une année, à partir d'une date donnée. */
function jours(depuis: string, combien: number): string[] {
  const t0 = Date.parse(`${depuis}T00:00:00.000Z`);
  return Array.from({ length: combien }, (_, i) =>
    new Date(t0 + i * 86400000).toISOString().slice(0, 10));
}

describe("le tirage du défi", () => {
  it("rend le MÊME défi pour un même jour, autant de fois qu'on demande", () => {
    // Sans ça, un rechargement de page changerait le défi en cours de journée.
    const a = defiDuJour("2026-09-04");
    for (let i = 0; i < 20; i += 1) expect(defiDuJour("2026-09-04").cle).toBe(a.cle);
  });

  it("ne rend JAMAIS le même deux jours de suite, sur une année entière", () => {
    /**
     * C'est la seule chose que la ligne promette : « différent chaque jour ».
     * Un tirage indépendant la tiendrait cinq fois sur six, ce qui n'est pas
     * la tenir — et le défaut ne se verrait qu'un matin, chez quelqu'un.
     */
    const suite = jours("2026-01-01", 365).map((j) => defiDuJour(j).cle);
    const repetitions = suite.filter((c, i) => i > 0 && c === suite[i - 1]);
    expect(repetitions).toEqual([]);
    // Le témoin : sans lui, une suite vide passerait le contrôle.
    expect(suite).toHaveLength(365);
  });

  it("les fait tous paraître, et à peu près autant les uns que les autres", () => {
    const suite = jours("2026-01-01", 366).map((j) => defiDuJour(j).cle);
    const compte = new Map<string, number>();
    for (const c of suite) compte.set(c, (compte.get(c) ?? 0) + 1);
    expect([...compte.keys()].sort()).toEqual(DEFIS.map((d) => d.cle).sort());
    // 366 jours sur six défis : 61 chacun si la rotation est propre. La
    // couture entre blocs en décale quelques-uns, jamais beaucoup.
    for (const n of compte.values()) expect(n).toBeGreaterThanOrEqual(50);
  });

  it("le décalage de fin ne peut pas recréer la couture", () => {
    /**
     * La condition qui rend la construction sûre, gardée plutôt que relue :
     * le dernier d'un bloc vaut `DEFIS[(b + DECALAGE_FIN) % n]`, le premier du
     * suivant `DEFIS[(b + 1) % n]`. Ils se confondent si DECALAGE_FIN vaut 1
     * modulo n, et le premier et le dernier d'un même bloc se confondent s'il
     * vaut 0. Ajouter un septième défi remettrait la question en jeu.
     */
    const n = DEFIS.length;
    expect(DECALAGE_FIN % n).not.toBe(0);
    expect(DECALAGE_FIN % n).not.toBe(1);
    expect(n).toBeGreaterThan(2);
  });

  it("le MILIEU du bloc est réellement mélangé, et pas seulement ses bouts", () => {
    /**
     * Le premier jet comparait le premier bloc à l'ordre de déclaration. Ça
     * passait sans aucun mélange : la construction déplace déjà le quatrième
     * défi à la fin, donc l'ordre diffère de toute façon. Le sabotage — le
     * mélange retiré — restait au vert.
     *
     * Ce qui distingue vraiment, ce sont deux blocs dont les BOUTS sont les
     * mêmes : les blocs 0 et 6 partagent leur premier et leur dernier, puisque
     * l'un et l'autre se prennent modulo six. Si leurs milieux coïncident,
     * c'est qu'il n'y a pas de mélange.
     */
    const n = DEFIS.length;
    const bloc = (b: number) =>
      jours(EPOQUE, (b + 1) * n).slice(b * n).map((j) => defiDuJour(j).cle);
    const zero = bloc(0);
    const six = bloc(6);
    expect(six[0]).toBe(zero[0]);
    expect(six[n - 1]).toBe(zero[n - 1]);
    expect(six.slice(1, -1)).not.toEqual(zero.slice(1, -1));
  });

  it("tient avant l'époque et sur une date illisible", () => {
    expect(rangDuJour(EPOQUE)).toBe(0);
    expect(rangDuJour("2025-12-31")).toBe(-1);
    expect(rangDuJour("pas un jour")).toBe(0);
    // Un rang négatif ne doit pas sortir de la liste.
    for (const j of ["2025-01-01", "2020-06-15", "pas un jour"]) {
      expect(DEFIS.map((d) => d.cle)).toContain(defiDuJour(j).cle);
    }
  });
});

describe("l'avancement d'un défi", () => {
  const parCle = (cle: string) => DEFIS.find((d) => d.cle === cle)!;

  it("se mesure sur la bonne colonne, et pas sur une autre", () => {
    // Le cas qui les distingue : trois parties jouées ne valent pas trois
    // victoires, et un défi qui lirait la mauvaise mesure serait rempli sans
    // qu'on ait fait ce qu'il demande.
    const source = { ...rien, partiesDuJour: 3, victoiresDuJour: 0 };
    expect(avancementDefi(parCle("parties3"), source).fait).toBe(true);
    expect(avancementDefi(parCle("victoires2"), source).fait).toBe(false);
  });

  it("est atteint AU seuil, pas un cran plus loin", () => {
    expect(avancementDefi(parCle("paye100"), { ...rien, pointsPayesDuJour: 99 }).fait).toBe(false);
    expect(avancementDefi(parCle("paye100"), { ...rien, pointsPayesDuJour: 100 }).fait).toBe(true);
  });

  it("borne l'avancement à la cible, sans jamais la dépasser", () => {
    const a = avancementDefi(parCle("paye100"), { ...rien, pointsPayesDuJour: 5000 });
    expect(a.ou).toBe(100);
    expect(a.fait).toBe(true);
  });

  it("écarte ce qui n'est pas un nombre plutôt que de rendre NaN", () => {
    const casse = { ...rien, pointsPayesDuJour: Number.NaN };
    expect(avancementDefi(parCle("paye100"), casse)).toMatchObject({ ou: 0, fait: false });
    const negatif = { ...rien, partiesDuJour: -4 };
    expect(avancementDefi(parCle("parties3"), negatif).ou).toBe(0);
  });

  it("aucun défi ne se remplit sans avoir rien fait", () => {
    // Un défi rempli à l'ouverture se lit comme une flatterie, et une
    // flatterie quotidienne finit par ne plus rien vouloir dire.
    for (const d of DEFIS) expect(avancementDefi(d, rien).fait).toBe(false);
  });
});

describe("les libellés", () => {
  /**
   * Le libellé se lit par la CLÉ du défi, construite au vol : le recensement
   * des clés mortes ne peut donc pas garantir qu'elle existe, et une clé
   * absente écrirait « undefined » en travers du tableau de bord. C'est le
   * défaut déjà rencontré sur la pastille en jeu, où seul un test l'avait
   * attrapé.
   */
  it("chaque défi du catalogue a une phrase dans les six langues", () => {
    const manquants: string[] = [];
    for (const langue of LANGUES) {
      const table = (defis as unknown as Record<string, Record<string, unknown>>)[langue];
      expect(table).toBeDefined();
      for (const d of DEFIS) {
        if (typeof table[d.cle] !== "function") manquants.push(`${langue}.${d.cle}`);
      }
    }
    expect(manquants).toEqual([]);
    // Le témoin : six langues fois six défis, ou le contrôle n'a rien lu.
    expect(LANGUES.length * DEFIS.length).toBeGreaterThanOrEqual(36);
  });

  it("chaque phrase place bien la cible qu'on lui donne", () => {
    // Un gabarit qui ignorerait son argument dirait « gagne 2 parties » quel
    // que soit le seuil, et le seuil vit dans le code.
    for (const langue of LANGUES) {
      const table = (defis as unknown as Record<string, Record<string, (n: number) => string>>)[langue];
      for (const d of DEFIS) {
        expect(table[d.cle](d.cible)).toContain(String(d.cible));
      }
    }
  });
});
