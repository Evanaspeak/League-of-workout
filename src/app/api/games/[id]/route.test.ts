import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { updateMany: jest.fn(), deleteMany: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const game = prisma.game as unknown as { updateMany: jest.Mock; deleteMany: jest.Mock; findFirst: jest.Mock };
const user = prisma.user as unknown as { findUnique: jest.Mock; update: jest.Mock };

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: unknown) =>
  PATCH(requete(`/api/games/${id}`, { method: "PATCH", body }), params(id));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur());
  game.updateMany.mockResolvedValue({ count: 1 });
  game.deleteMany.mockResolvedValue({ count: 1 });
  game.findFirst.mockResolvedValue({ exercice: "pompes", repartition: null, pompesCalculees: 38 });
  user.findUnique.mockResolvedValue({ dettePointsDus: 100 });
  user.update.mockResolvedValue({ dettePointsDus: 100 });
});

/**
 * Modifier ou supprimer une partie touche deux choses : la ligne elle-même, et
 * le compteur de dette qu'elle avait alimenté. Les deux sont éprouvés, ainsi
 * que la seule règle qui protège vraiment les comptes entre eux : toute
 * requête est filtrée sur l'identifiant du demandeur.
 */
describe("PATCH /api/games/[id]", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await patch("g1", { date: "2026-01-01T10:00" })).status).toBe(401);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("corrige la date d'une partie", async () => {
    const r = await patch("g1", { date: "2026-01-01T10:00" });
    expect(r.status).toBe(200);
    expect(game.updateMany.mock.calls[0][0].where).toEqual({ id: "g1", userId: "u1" });
  });

  it("ne touche jamais qu'aux parties du demandeur", async () => {
    // La restriction porte sur la requête elle-même, pas sur un test préalable :
    // il n'existe donc pas de fenêtre où la partie d'un autre serait modifiable.
    session.mockResolvedValue(utilisateur({ id: "autre" }));
    await patch("g1", { date: "2026-01-01T10:00" });
    expect(game.updateMany.mock.calls[0][0].where.userId).toBe("autre");
  });

  it("répond 404 quand la partie n'appartient pas au demandeur", async () => {
    game.updateMany.mockResolvedValue({ count: 0 });
    expect((await patch("g1", { date: "2026-01-01T10:00" })).status).toBe(404);
  });

  it("refuse une date absente", async () => {
    const r = await patch("g1", {});
    expect(r.status).toBe(400);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("refuse une date dans le futur", async () => {
    const demain = new Date(Date.now() + 86_400_000).toISOString();
    const r = await patch("g1", { date: demain });
    expect(r.status).toBe(400);
    expect(String((await corps(r)).error)).toMatch(/futur/);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("refuse une date qui n'en est pas une", async () => {
    expect((await patch("g1", { date: "hier soir" })).status).toBe(400);
  });
});

describe("DELETE /api/games/[id]", () => {
  const del = (id: string) => DELETE(requete(`/api/games/${id}`, { method: "DELETE" }), params(id));

  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await del("g1")).status).toBe(401);
    expect(game.deleteMany).not.toHaveBeenCalled();
  });

  it("répond 404 quand la partie n'est pas celle du demandeur", async () => {
    game.findFirst.mockResolvedValue(null);
    expect((await del("g1")).status).toBe(404);
    expect(game.deleteMany).not.toHaveBeenCalled();
  });

  it("supprime la partie du demandeur", async () => {
    const r = await del("g1");
    expect(r.status).toBe(200);
    expect(game.deleteMany.mock.calls[0][0].where).toEqual({ id: "g1", userId: "u1" });
  });

  it("laisse le compteur tranquille pour un exercice sans attente", async () => {
    // Des pompes se font dans la foulée : elles n'entrent jamais au compteur,
    // donc les supprimer n'a rien à en retirer.
    await del("g1");
    expect(user.update).not.toHaveBeenCalled();
  });

  it("retire du compteur ce que la partie y avait mis", async () => {
    game.findFirst.mockResolvedValue({ exercice: "boxe", repartition: null, pompesCalculees: 38 });
    await del("g1");
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(62);
  });

  it("ne fait jamais passer le compteur sous zéro", async () => {
    game.findFirst.mockResolvedValue({ exercice: "boxe", repartition: null, pompesCalculees: 500 });
    user.findUnique.mockResolvedValue({ dettePointsDus: 20 });
    await del("g1");
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(0);
  });

  it("ne retire que la part en attente d'une partie ventilée", async () => {
    game.findFirst.mockResolvedValue({
      exercice: "pompes",
      repartition: JSON.stringify({ pompes: 19, boxe: 19 }),
      pompesCalculees: 38,
    });
    await del("g1");
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(81);
  });
});
