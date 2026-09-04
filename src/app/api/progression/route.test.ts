import { corps, requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { aggregate: jest.fn(), findMany: jest.fn() },
    paiement: { findMany: jest.fn(), groupBy: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { GET as GET_BADGES } from "../badges/route";
import { GET as GET_SERIE } from "../serie/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { niveauPourPoints } from "@/lib/niveauCompte";
import { defiDuJour } from "@/lib/defiQuotidien";

const session = getCurrentUser as jest.Mock;
const base = prisma as unknown as {
  game: { aggregate: jest.Mock; findMany: jest.Mock };
  paiement: { findMany: jest.Mock; groupBy: jest.Mock };
};

const JOURS = ["2026-09-02", "2026-09-01", "2026-08-31", "2026-08-29"];

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ dettePointsDus: 0, detteDepuis: null }));
  base.game.aggregate.mockResolvedValue({ _sum: { pompesCalculees: 9000 }, _count: { _all: 57 } });
  base.game.findMany.mockResolvedValue([]);
  base.paiement.groupBy.mockResolvedValue([]);
  // Trente points payés par jour, quatre jours : 120 payés contre 4 200
  // générés. Les deux chiffres sont volontairement TRÈS différents, sans quoi
  // rien ne dirait lequel des deux le niveau emploie.
  base.paiement.findMany.mockResolvedValue(JOURS.map((jour) => ({ jour, points: 30 })));
});

describe("sans session", () => {
  it("refuse", async () => {
    session.mockResolvedValue(null);
    expect((await GET(requete("/api/progression?jour=2026-09-02"))).status).toBe(401);
    expect(base.paiement.findMany).not.toHaveBeenCalled();
  });
});

describe("la progression", () => {
  it("ne lit les paiements QU'UNE FOIS", async () => {
    /**
     * C'est la raison d'être de cette route. Les deux d'origine faisaient
     * chacune la même requête : deux allers-retours vers la base pour deux
     * réponses qui se déduisent des mêmes lignes.
     */
    await GET(requete("/api/progression?jour=2026-09-02"));
    expect(base.paiement.findMany).toHaveBeenCalledTimes(1);
    expect(base.game.aggregate).toHaveBeenCalledTimes(1);
  });

  it("rend mot pour mot ce que rendaient les deux routes", async () => {
    const reponse = await GET(requete("/api/progression?jour=2026-09-02"));
    const fusion = await corps(reponse) as Record<string, unknown>;
    jest.clearAllMocks();
    base.game.aggregate.mockResolvedValue({ _sum: { pompesCalculees: 9000 }, _count: { _all: 57 } });
    base.paiement.findMany.mockResolvedValue(JOURS.map((jour) => ({ jour, points: 30 })));
    const badges = await corps(await GET_BADGES());
    const serie = await corps(await GET_SERIE(requete("/api/serie?jour=2026-09-02")));

    expect(fusion.badges).toEqual(badges);
    expect(fusion.serie).toEqual(serie);
  });

  it("rend le niveau et le titre SANS lire une ligne de plus", async () => {
    /**
     * Le niveau et le titre se déduisent exactement de ce que cette route
     * compose déjà. Leur donner une route à eux ferait un aller-retour de
     * plus vers Neon pour relire les mêmes paiements — c'est le défaut que
     * cette route existe pour avoir corrigé, et il se referait en silence.
     */
    const corpsRep = await corps(await GET(requete("/api/progression?jour=2026-09-02"))) as {
      badges: { niveau: { niveau: number; restant: number; part: number }; titre: string | null };
    };
    expect(base.paiement.findMany).toHaveBeenCalledTimes(1);
    expect(corpsRep.badges.niveau.part).toBeGreaterThanOrEqual(0);
    expect(corpsRep.badges.niveau.part).toBeLessThanOrEqual(1);
    // 120 payés : premier pas, et rien de plus. 9 000 GÉNÉRÉS donneraient
    // « endurant » — c'est ce que ce contrôle refuse.
    expect(corpsRep.badges.titre).toBe("premierPas");
  });

  it("calcule le niveau sur ce qui a été PAYÉ, pas sur ce que les parties ont coûté", () => {
    /**
     * La décision de fond, et la seule que ce fichier puisse tenir.
     *
     * Le double rend 4 200 points GÉNÉRÉS et 120 PAYÉS : deux chiffres qui
     * donnent deux niveaux très éloignés. Prendre le mauvais ferait monter
     * celui qui perd sans jamais payer — sur un produit dont le sujet est de
     * payer, c'est le contresens exact, et il ne se verrait pas : le niveau
     * monterait, simplement plus vite qu'il ne devrait.
     */
    return GET(requete("/api/progression?jour=2026-09-02"))
      .then((r) => corps(r) as Promise<{ badges: { niveau: { niveau: number } } }>)
      .then((c) => {
        // 120 payés : seuil du niveau 2 à 50, du niveau 3 à 150.
        expect(c.badges.niveau.niveau).toBe(2);
        // Le témoin : 9 000 générés donneraient le niveau 19. Sans lui, un
        // niveau figé à 2 passerait le contrôle en ne prouvant rien.
        expect(niveauPourPoints(9000)).toBe(19);
      });
  });

  it("mesure le défi du jour sur le JOUR demandé, et sur lui seul", async () => {
    /**
     * Deux paiements, un seul dans la journée demandée. Sans le filtre, le
     * défi serait rempli par l'effort d'un autre jour — ce qui est le défaut
     * exact qu'un défi de vingt-quatre heures ne peut pas se permettre.
     */
    base.paiement.findMany.mockResolvedValue([
      { jour: "2026-09-02", points: 120 },
      { jour: "2026-08-14", points: 9000 },
    ]);
    // Deux parties le jour demandé, une troisième plus tôt dans le MOIS : la
    // requête ne rend plus le jour mais le mois, et c'est la page qui
    // redécoupe. Sans cette troisième ligne, rien ne dirait que le découpage
    // se fait, puisque mois et jour rendraient le même compte.
    base.game.findMany.mockResolvedValue([
      { result: "V", jeu: "League of Legends", date: new Date("2026-09-02T20:00:00.000Z") },
      { result: "D", jeu: "Apex Legends", date: new Date("2026-09-02T21:00:00.000Z") },
      { result: "V", jeu: "League of Legends", date: new Date("2026-09-01T18:00:00.000Z") },
    ]);
    const c = await corps(await GET(requete("/api/progression?jour=2026-09-02"))) as {
      defi: { cle: string; cible: number; ou: number; fait: boolean };
    };
    /**
     * Le 2 septembre 2026 tombe sur « paie 300 points », ce qui n'est pas un
     * détail : c'est ce qui rend le contrôle DISCRIMINANT. Cent vingt points
     * payés ce jour-là ne suffisent pas ; les neuf mille du 14 août
     * suffiraient largement, et c'est exactement ce qu'un défi qui compterait
     * tous les paiements laisserait passer.
     */
    expect(c.defi.cle).toBe(defiDuJour("2026-09-02").cle);
    expect(c.defi.cle).toBe("paye300");
    expect(c.defi.ou).toBe(120);
    expect(c.defi.fait).toBe(false);

    // Le témoin : la borne du jour est bien passée à la requête sur les
    // parties, sinon celles d'hier compteraient.
    const ou = base.game.findMany.mock.calls[0][0].where;
    expect(ou.userId).toBeDefined();
    // La requête part au PREMIER du mois, et la journée se redécoupe ensuite.
    expect(ou.date.gte.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(ou.date.lte.toISOString()).toBe("2026-09-02T23:59:59.999Z");
    expect(ou.sansEnjeu).toBe(false);
  });

  it("compte le MOIS pour les défis mensuels, et le JOUR pour celui du jour", async () => {
    /**
     * Le contrôle qui distingue les deux découpages, et il ne peut le faire
     * que parce que le double rend trois parties dont une hors de la journée.
     * Un défi mensuel qui compterait le jour, ou un défi quotidien qui
     * compterait le mois, rendrait ici le même chiffre des deux côtés.
     */
    base.paiement.findMany.mockResolvedValue([
      { jour: "2026-09-02", points: 120 },
      { jour: "2026-08-14", points: 9000 },
    ]);
    base.game.findMany.mockResolvedValue([
      { result: "V", jeu: "League of Legends", date: new Date("2026-09-02T20:00:00.000Z") },
      { result: "D", jeu: "Apex Legends", date: new Date("2026-09-02T21:00:00.000Z") },
      { result: "V", jeu: "League of Legends", date: new Date("2026-09-01T18:00:00.000Z") },
    ]);
    const c = await corps(await GET(requete("/api/progression?jour=2026-09-02"))) as {
      defi: { cle: string; ou: number };
      defisMois: { cle: string; ou: number }[];
    };
    const parties = c.defisMois.find((d) => d.cle === "moisParties");
    expect(parties?.ou).toBe(3);
    // Cent vingt le 2 septembre, neuf mille le 14 AOÛT : le mois n'en compte
    // que cent vingt.
    expect(c.defisMois.find((d) => d.cle === "moisPoints")?.ou).toBe(120);
    // Et le défi du JOUR, lui, ne voit que les deux parties du 2 septembre.
    // C'est le même jeu de données : le contrôle ne vaut que par l'écart.
    expect(c.defi.cle).toBe("paye300");
    expect(c.defi.ou).toBe(120);
  });

  it("le défi du JOUR ne compte pas les parties du reste du mois", async () => {
    /**
     * Le 8 septembre 2026 tombe sur « enregistre 3 parties », et c'est ce qui
     * rend le contrôle possible : sur une date dont le défi porte sur les
     * PAIEMENTS, le découpage des parties ne changerait rien et le sabotage
     * passerait au vert — ce qu'il a fait au premier essai.
     *
     * Deux parties le 8, trois autres plus tôt dans le mois : le défi du jour
     * en voit deux, celui du mois en voit cinq.
     */
    base.game.findMany.mockResolvedValue([
      { result: "V", jeu: "League of Legends", date: new Date("2026-09-08T20:00:00.000Z") },
      { result: "D", jeu: "Apex Legends", date: new Date("2026-09-08T21:00:00.000Z") },
      { result: "V", jeu: "League of Legends", date: new Date("2026-09-01T18:00:00.000Z") },
      { result: "V", jeu: "League of Legends", date: new Date("2026-09-02T18:00:00.000Z") },
      { result: "D", jeu: "League of Legends", date: new Date("2026-09-03T18:00:00.000Z") },
    ]);
    const c = await corps(await GET(requete("/api/progression?jour=2026-09-08"))) as {
      defi: { cle: string; ou: number; cible: number; fait: boolean };
      defisMois: { cle: string; ou: number }[];
    };
    expect(c.defi.cle).toBe("parties3");
    expect(c.defi.ou).toBe(2);
    expect(c.defi.fait).toBe(false);
    expect(c.defisMois.find((d) => d.cle === "moisParties")?.ou).toBe(5);
  });

  it("filtre par compte des deux côtés", async () => {
    await GET(requete("/api/progression?jour=2026-09-02"));
    for (const appel of [base.paiement.findMany, base.game.aggregate]) {
      expect(appel.mock.calls[0][0].where.userId).toBeDefined();
    }
  });

  it("prend le jour du navigateur, et refuse ce qui n'en est pas un", async () => {
    const r1 = await GET(requete("/api/progression?jour=2026-09-02"));
    const bon = await corps(r1) as { serie: { payeAujourdhui: boolean } };
    expect(bon.serie.payeAujourdhui).toBe(true);
    // Une valeur qui n'a pas la forme d'une date retombe sur le jour du
    // serveur plutôt que d'aller telle quelle dans une comparaison.
    const r2 = await GET(requete("/api/progression?jour=hier"));
    const bancal = await corps(r2) as { serie: { payeAujourdhui: boolean } };
    expect(typeof bancal.serie.payeAujourdhui).toBe("boolean");
  });

  /**
   * Le cas qui passait : « 9999-99-99 » respecte le motif sans être une date.
   *
   * Il était employé TEL QUEL, donc la série valait zéro — et le repli prévu
   * pour ce cas exact était court-circuité par le contrôle qui le laissait
   * passer. La comparaison porte sur le repli lui-même : avec cette valeur, la
   * réponse doit être celle qu'on obtient SANS jour du tout.
   */
  it("retombe sur le jour du serveur quand la date a la forme sans exister", async () => {
    const sansJour = await corps(await GET(requete("/api/progression")));
    const bidon = await corps(await GET(requete("/api/progression?jour=9999-99-99")));
    expect(bidon).toEqual(sansJour);

    // Et un jour qui n'existe pas dans son mois tombe pareil : `Date` le fait
    // glisser au lieu de le refuser, ce qu'un contrôle de forme ne voit pas.
    const glissant = await corps(await GET(requete("/api/progression?jour=2026-02-30")));
    expect(glissant).toEqual(sansJour);
  });
});
