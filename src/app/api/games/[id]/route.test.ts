import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { updateMany: jest.fn(), deleteMany: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
// La configuration de barème est semée par la route quand elle manque : ici
// la base est doublée, il n'y a rien à semer.
jest.mock("@/lib/seed-defaults", () => ({ seedDefaults: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const game = prisma.game as unknown as { updateMany: jest.Mock; deleteMany: jest.Mock; findFirst: jest.Mock };
const user = prisma.user as unknown as { findUnique: jest.Mock; update: jest.Mock };

/** Ce que la base contient, entre deux appels de la doublure d'`update`. */
let compteur = 100;

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
  // Le retrait passe par `decrement`, qui est atomique côté base. La doublure
  // le simule : sans ça, on éprouverait une écriture absolue qui n'existe plus.
  compteur = 100;
  user.update.mockImplementation(async ({ data }: { data: { dettePointsDus: number | { decrement: number } } }) => {
    const v = data.dettePointsDus;
    compteur = typeof v === "number" ? v : compteur - v.decrement;
    return { dettePointsDus: compteur };
  });
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
    const r = await del("g1");
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ decrement: 38 });
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(62);
  });

  it("ne fait jamais passer le compteur sous zéro", async () => {
    game.findFirst.mockResolvedValue({ exercice: "boxe", repartition: null, pompesCalculees: 500 });
    compteur = 20;
    const r = await del("g1");
    // `decrement` n'a pas de plancher : la remise à zéro suit, avec la date de
    // début de dette qui n'a plus lieu d'être.
    expect(user.update.mock.calls[1][0].data)
      .toEqual({ dettePointsDus: 0, detteDepuis: null });
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(0);
  });

  it("ne retire que la part en attente d'une partie ventilée", async () => {
    game.findFirst.mockResolvedValue({
      exercice: "pompes",
      repartition: JSON.stringify({ pompes: 19, boxe: 19 }),
      pompesCalculees: 38,
    });
    const r = await del("g1");
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ decrement: 19 });
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(81);
  });

  it("retire un montant, pas un état : une partie arrivée entre-temps survit", async () => {
    // Le défaut : on lisait la dette, on calculait ce qui reste, on écrivait
    // cette valeur absolue. Une partie enregistrée entre les deux voyait sa
    // dette effacée.
    game.findFirst.mockResolvedValue({ exercice: "boxe", repartition: null, pompesCalculees: 38 });
    // La lecture initiale voit 100 ; la base en contient 130 au moment d'écrire.
    user.findUnique.mockResolvedValue({ dettePointsDus: 100 });
    compteur = 130;
    const r = await del("g1");
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(92);
  });
});
