import { corps, requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { aggregate: jest.fn() },
    paiement: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { GET as GET_BADGES } from "../badges/route";
import { GET as GET_SERIE } from "../serie/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const base = prisma as unknown as {
  game: { aggregate: jest.Mock };
  paiement: { findMany: jest.Mock };
};

const JOURS = ["2026-09-02", "2026-09-01", "2026-08-31", "2026-08-29"];

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ dettePointsDus: 0, detteDepuis: null }));
  base.game.aggregate.mockResolvedValue({ _sum: { pompesCalculees: 4200 }, _count: { _all: 57 } });
  base.paiement.findMany.mockResolvedValue(JOURS.map((jour) => ({ jour })));
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
    base.game.aggregate.mockResolvedValue({ _sum: { pompesCalculees: 4200 }, _count: { _all: 57 } });
    base.paiement.findMany.mockResolvedValue(JOURS.map((jour) => ({ jour })));
    const badges = await corps(await GET_BADGES());
    const serie = await corps(await GET_SERIE(requete("/api/serie?jour=2026-09-02")));

    expect(fusion.badges).toEqual(badges);
    expect(fusion.serie).toEqual(serie);
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
});
