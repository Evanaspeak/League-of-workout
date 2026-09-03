import { corps, requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    amitie: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    paiement: { aggregate: jest.fn(), findMany: jest.fn() },
    game: { count: jest.fn(), groupBy: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  amitie: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock };
  paiement: { aggregate: jest.Mock; findMany: jest.Mock };
  game: { count: jest.Mock; groupBy: jest.Mock };
};

const lire = (id = "toi") =>
  GET(requete(`/api/amis/${id}/profil`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.amitie.findFirst.mockResolvedValue({ id: "lien1" });
  db.user.findUnique.mockResolvedValue({
    id: "toi", pseudo: "Toi", detteDepuis: null, dettePointsDus: 0, partageAmis: "total",
  });
  db.paiement.aggregate.mockResolvedValue({ _sum: { points: 120 } });
  db.paiement.findMany.mockResolvedValue([]);
  db.game.count.mockResolvedValue(42);
  db.game.groupBy.mockResolvedValue([{ jeu: "League of Legends", _count: { _all: 30 } }]);
});

describe("accès", () => {
  it("refuse sans session, et ne lit rien", async () => {
    session.mockResolvedValue(null);
    expect((await lire()).status).toBe(401);
    expect(db.amitie.findFirst).not.toHaveBeenCalled();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  /**
   * Une demande EN ATTENTE ne donne aucun droit : sinon demander suffirait à
   * regarder, et personne n'aurait à accepter quoi que ce soit.
   */
  it("exige une amitié acceptée, dans les deux sens", async () => {
    await lire();
    const where = db.amitie.findFirst.mock.calls[0][0].where;
    expect(where.etat).toBe("acceptee");
    expect(where.OR).toEqual([
      { demandeurId: "moi", receveurId: "toi" },
      { demandeurId: "toi", receveurId: "moi" },
    ]);
  });

  /**
   * 404 et non 403 : distinguer « pas votre ami » de « n'existe pas »
   * apprendrait, identifiant par identifiant, quels comptes existent.
   */
  it("sans amitié, rend 404 et ne lit AUCUNE statistique", async () => {
    db.amitie.findFirst.mockResolvedValue(null);
    expect((await lire()).status).toBe(404);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.paiement.aggregate).not.toHaveBeenCalled();
    expect(db.game.count).not.toHaveBeenCalled();
  });
});

describe("ce que l'ami autorise", () => {
  it("par défaut, seulement le total : le détail n'est pas dans la réponse", async () => {
    const c = await corps(await lire());
    expect(Object.keys(c).sort())
      .toEqual(["enRetard", "joursDeRetard", "partage", "points", "pseudo"]);
  });

  it("quand il l'autorise, le détail s'ajoute", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "toi", pseudo: "Toi", detteDepuis: null, dettePointsDus: 0, partageAmis: "detail",
    });
    const c = await corps(await lire());
    expect({ partage: c.partage, parties: c.parties, jeu: c.jeuFavori })
      .toEqual({ partage: "detail", parties: 42, jeu: "League of Legends" });
  });

  /** Une valeur inconnue en base retombe sur le plus fermé, jamais l'inverse. */
  it("une valeur illisible ne fait pas partager davantage", async () => {
    for (const brut of ["tout", null, undefined, "DETAIL"]) {
      db.user.findUnique.mockResolvedValue({
        id: "toi", pseudo: "Toi", detteDepuis: null, dettePointsDus: 0, partageAmis: brut,
      });
      const c = await corps(await lire());
      expect({ valeur: brut, partage: c.partage }).toEqual({ valeur: brut, partage: "total" });
    }
  });

  it("ne lit que le compte demandé, jamais le sien par erreur", async () => {
    await lire("toi");
    expect(db.user.findUnique.mock.calls[0][0].where).toEqual({ id: "toi" });
    expect(db.paiement.aggregate.mock.calls[0][0].where.userId).toBe("toi");
    expect(db.game.count.mock.calls[0][0].where.userId).toBe("toi");
  });

  it("le retard voyage dans les deux cas : le classement le montre déjà", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "toi", pseudo: "Toi",
      detteDepuis: new Date(Date.now() - 5 * 86_400_000), dettePointsDus: 60,
      partageAmis: "total",
    });
    const c = await corps(await lire());
    expect({ enRetard: c.enRetard, jours: c.joursDeRetard }).toEqual({ enRetard: true, jours: 5 });
  });

  /** Les parties sans enjeu ne comptent nulle part, ici comme ailleurs. */
  it("écarte les parties sans enjeu du compte et du jeu favori", async () => {
    await lire();
    expect(db.game.count.mock.calls[0][0].where.sansEnjeu).toBe(false);
    expect(db.game.groupBy.mock.calls[0][0].where.sansEnjeu).toBe(false);
  });
});
