import { corps, requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    amitie: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    paiement: { groupBy: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { JOURS_CLASSEMENT } from "@/lib/classement";
import { jourLocal } from "@/lib/serie";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  amitie: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
  paiement: { groupBy: jest.Mock };
};

const personne = (id: string, pseudo: string, extra = {}) =>
  ({ id, pseudo, detteDepuis: null, dettePointsDus: 0, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.amitie.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([personne("moi", "Moi")]);
  db.paiement.groupBy.mockResolvedValue([]);
});

type Ligne = {
  id: string; pseudo: string; points: number; rang: number;
  moi: boolean; enRetard: boolean; joursDeRetard: number;
};
type Reponse = { lignes: Ligne[]; debut: string; jours: number; ecart: number | null };

const lire = async (jour?: string): Promise<Response> =>
  GET(requete(`/api/classement${jour ? `?jour=${jour}` : ""}`));

const lu = async (jour?: string): Promise<Reponse> =>
  (await corps(await lire(jour))) as Reponse;

describe("accès", () => {
  it("refuse sans session, et ne lit rien", async () => {
    session.mockResolvedValue(null);
    expect((await lire()).status).toBe(401);
    expect(db.amitie.findMany).not.toHaveBeenCalled();
    expect(db.paiement.groupBy).not.toHaveBeenCalled();
  });
});

describe("qui figure au classement", () => {
  it("soi-même y figure, même sans un seul ami", async () => {
    const c = await lu();
    expect(c.lignes).toEqual([expect.objectContaining({ pseudo: "Moi", moi: true, points: 0, rang: 1 })]);
  });

  it("prend les deux sens de l'amitié, et seulement les acceptées", async () => {
    db.amitie.findMany.mockResolvedValue([
      { demandeurId: "moi", receveurId: "a" },
      { demandeurId: "b", receveurId: "moi" },
    ]);
    await lire();
    expect(db.user.findMany.mock.calls[0][0].where.id.in.sort()).toEqual(["a", "b", "moi"]);
    expect(db.amitie.findMany.mock.calls[0][0].where.etat).toBe("acceptee");
  });

  /**
   * Le témoin du filtrage : la somme des paiements ne porte QUE sur les
   * identifiants tirés de l'amitié. Sans ce `where`, la route rendrait le
   * volume payé de toute la base — c'est-à-dire le classement de gens qui
   * n'ont rien demandé.
   */
  it("ne somme les paiements que des comptes retenus", async () => {
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    await lire();
    expect(db.paiement.groupBy.mock.calls[0][0].where.userId.in.sort()).toEqual(["a", "moi"]);
  });

  it("ne rend que le pseudo, les points et le retard : jamais le compte", async () => {
    db.user.findMany.mockResolvedValue([
      personne("moi", "Moi"),
      personne("a", "Alice"),
    ]);
    const c = await lu();
    for (const l of c.lignes) {
      expect(Object.keys(l).sort()).toEqual(
        ["enRetard", "id", "joursDeRetard", "moi", "points", "pseudo", "rang"]);
    }
  });
});

/**
 * Le mode fantôme.
 *
 * Il ferme un trou que le classement a ouvert : celui-ci publie le pseudo et
 * l'état de retard à tous ses amis, et la seule façon d'en sortir était de
 * retirer l'ami — c'est-à-dire de casser le lien pour éviter ce qu'il montre.
 */
describe("le mode fantôme", () => {
  it("écarte les fantômes à la LECTURE, pas à l'affichage", async () => {
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    await lire();
    /**
     * La condition part en base. Filtrée après coup, la ligne sortirait quand
     * même de la base et traverserait le réseau : elle serait dans l'onglet
     * réseau de qui regarde, c'est-à-dire exactement là où quelqu'un a demandé
     * à ne pas être.
     */
    expect(db.user.findMany.mock.calls[0][0].where.OR)
      .toEqual([{ fantome: false }, { id: "moi" }]);
  });

  it("se voit toujours soi-même, fantôme ou non", async () => {
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    await lire();
    const ou = db.user.findMany.mock.calls[0][0].where.OR as Array<Record<string, unknown>>;
    // Un classement où l'on ne figure pas n'est pas son classement, et se
    // cacher des autres n'est pas se cacher de soi.
    expect(ou.some((c) => c.id === "moi")).toBe(true);
  });
});

describe("la fenêtre", () => {
  it("va des sept derniers jours à aujourd'hui, bornée des deux côtés", async () => {
    const c = await lu("2026-09-03");
    expect(c.debut).toBe("2026-08-28");
    expect(c.jours).toBe(JOURS_CLASSEMENT);
    expect(db.paiement.groupBy.mock.calls[0][0].where.jour)
      .toEqual({ gte: "2026-08-28", lte: "2026-09-03" });
  });

  /**
   * « 9999-99-99 » respecte la forme et n'est pas une date. Le repli est le
   * jour local, pas un jour inventé : le contrôle porte sur l'aller-retour,
   * comme dans `/api/progression` où le motif seul avait rendu une série de
   * zéro.
   */
  it("un jour impossible retombe sur le jour local, pas sur lui-même", async () => {
    const c = await lu("9999-99-99");
    expect(c.debut).not.toContain("9999");
    expect(db.paiement.groupBy.mock.calls[0][0].where.jour.lte).toBe(jourLocal());
  });

  it("une fenêtre sans paiement rend zéro, pas une absence", async () => {
    db.paiement.groupBy.mockResolvedValue([{ userId: "moi", _sum: { points: null } }]);
    const c = await lu();
    expect(c.lignes[0].points).toBe(0);
  });
});

describe("ce que le classement dit", () => {
  it("ordonne sur le volume payé et donne l'écart au premier", async () => {
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    db.user.findMany.mockResolvedValue([personne("moi", "Moi"), personne("a", "Alice")]);
    db.paiement.groupBy.mockResolvedValue([
      { userId: "moi", _sum: { points: 40 } },
      { userId: "a", _sum: { points: 150 } },
    ]);
    const c = await lu();
    expect(c.lignes.map((l) => l.pseudo)).toEqual(["Alice", "Moi"]);
    expect(c.ecart).toBe(110);
  });

  it("dit qu'un ami est en retard, avec le nombre de jours", async () => {
    const vieux = new Date(Date.now() - 5 * 86_400_000);
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    db.user.findMany.mockResolvedValue([
      personne("moi", "Moi"),
      personne("a", "Alice", { detteDepuis: vieux, dettePointsDus: 60 }),
    ]);
    const c = await lu();
    const alice = c.lignes.find((l) => l.pseudo === "Alice")!;
    expect(alice.enRetard).toBe(true);
    expect(alice.joursDeRetard).toBe(5);
  });
});
