import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findMany: jest.fn() },
    goal: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET as tableauDeBord } from "./route";
import { GET as journee } from "./daily/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const game = prisma.game as unknown as { findMany: jest.Mock };

/** Une partie plausible, telle que la base la rend. */
const partie = (champs: Record<string, unknown> = {}) => ({
  id: "g1", userId: "u1", date: new Date("2026-08-19T21:30:00Z"),
  role: "MID", champion: "Ahri", kills: 2, deaths: 9, assists: 4,
  result: "D", gainageSec: 60, niveauCalcule: 3, pompesCalculees: 38,
  exercice: "pompes", repartition: null, jeu: "League of Legends",
  typeJeu: "parties", source: "manuel", ...champs,
});

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ exercices: ["pompes"] }));
  game.findMany.mockResolvedValue([partie()]);
  (prisma.goal.findUnique as jest.Mock).mockResolvedValue({ objectifTotalPompes: 1000 });
});

const dash = (q = "") => tableauDeBord(requete("/api/dashboard" + q));
const jour = (q: string) => journee(requete("/api/dashboard/daily" + q));

describe("GET /api/dashboard", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await dash()).status).toBe(401);
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("ne lit que les parties du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await dash();
    expect(game.findMany.mock.calls[0][0].where).toEqual({ userId: "u42" });
  });

  it("rend un tableau de bord vide sans planter", async () => {
    // Le premier écran que voit un inscrit : il ne doit pas tomber en erreur
    // parce qu'il n'y a encore rien à afficher.
    game.findMany.mockResolvedValue([]);
    (prisma.goal.findUnique as jest.Mock).mockResolvedValue(null);
    const r = await dash();
    expect(r.status).toBe(200);
    expect(await corps(r)).toBeTruthy();
  });

  it("compte le total d'effort", async () => {
    game.findMany.mockResolvedValue([partie(), partie({ id: "g2", pompesCalculees: 12 })]);
    const brut = JSON.stringify(await corps(await dash()));
    expect(brut).toContain("50");
  });
});

describe("GET /api/dashboard/daily", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await jour("?date=2026-08-19")).status).toBe(401);
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("refuse une date absente ou mal formée", async () => {
    for (const q of ["", "?date=hier", "?date=2026-8-9", "?date=2026-08-19T10:00"]) {
      expect((await jour(q)).status).toBe(400);
    }
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("borne la requête à la journée demandée, et au demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await jour("?date=2026-08-19");
    const where = game.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u42");
    expect(where.date.gte.toISOString()).toBe("2026-08-19T00:00:00.000Z");
    expect(where.date.lte.toISOString()).toBe("2026-08-19T23:59:59.999Z");
  });

  it("ne rend aucune heure quand la journée est vide", async () => {
    // Les heures sans effort sont écartées : le graphique montre la soirée
    // réellement jouée, pas vingt-quatre colonnes dont vingt-deux à zéro.
    game.findMany.mockResolvedValue([]);
    const d = await corps(await jour("?date=2026-08-19")) as { hourly: unknown[]; total: number; games: number };
    expect(d.hourly).toHaveLength(0);
    expect(d.total).toBe(0);
    expect(d.games).toBe(0);
  });

  it("range l'effort à la bonne heure", async () => {
    const d = await corps(await jour("?date=2026-08-19")) as { hourly: { label: string; total: number }[] };
    expect(d.hourly).toEqual([{ label: "21h", total: 38 }]);
  });

  it("cumule plusieurs parties dans la même heure", async () => {
    game.findMany.mockResolvedValue([
      partie(),
      partie({ id: "g2", date: new Date("2026-08-19T21:52:00Z"), pompesCalculees: 12 }),
      partie({ id: "g3", date: new Date("2026-08-19T23:05:00Z"), pompesCalculees: 5 }),
    ]);
    const d = await corps(await jour("?date=2026-08-19")) as { hourly: { label: string; total: number }[]; total: number };
    expect(d.hourly).toEqual([{ label: "21h", total: 50 }, { label: "23h", total: 5 }]);
    expect(d.total).toBe(55);
  });
});
