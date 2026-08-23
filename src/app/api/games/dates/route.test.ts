import { requete, requeteCassee, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => {
  const game = { findMany: jest.fn(), update: jest.fn() };
  return {
    prisma: {
      game,
      // Les mises à jour partent ensemble : la moitié appliquée serait pire
      // que rien, puisqu'on ne saurait plus laquelle.
      $transaction: jest.fn(async (travaux: unknown[]) => travaux),
    },
  };
});
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const game = (prisma as unknown as { game: Record<string, jest.Mock> }).game;

const corriger = (body: unknown) =>
  PATCH(requete("/api/games/dates", { method: "PATCH", body }));

const LE_15 = new Date("2026-08-15T21:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "u1" }));
  game.findMany.mockResolvedValue([{ id: "g1", date: LE_15 }, { id: "g2", date: new Date("2026-08-15T22:30:00Z") }]);
  game.update.mockImplementation((a: unknown) => a);
});

describe("accès", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await corriger({ ids: ["g1"], decalageMinutes: -60 })).status).toBe(401);
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("refiltre la sélection sur le compte", async () => {
    // Une liste d'identifiants vient du navigateur : rien n'empêche d'y
    // glisser ceux de quelqu'un d'autre.
    await corriger({ ids: ["g1", "vole"], decalageMinutes: -60 });
    expect(game.findMany.mock.calls[0][0].where.userId).toBe("u1");
  });
});

describe("décalage", () => {
  it("déplace en gardant les écarts entre parties", async () => {
    // C'est tout l'intérêt : une soirée datée du lendemain se recale d'un
    // bloc, sans écraser l'ordre ni les heures relatives.
    await corriger({ ids: ["g1", "g2"], decalageMinutes: -24 * 60 });
    const dates = game.update.mock.calls.map((c) => c[0].data.date.toISOString());
    expect(dates[0]).toBe("2026-08-14T21:00:00.000Z");
    expect(dates[1]).toBe("2026-08-14T22:30:00.000Z");
  });

  it("refuse un décalage nul, démesuré ou illisible", async () => {
    for (const decalageMinutes of [0, 400 * 24 * 60, -400 * 24 * 60, "hier", NaN]) {
      expect((await corriger({ ids: ["g1"], decalageMinutes })).status).toBe(400);
    }
    expect(game.update).not.toHaveBeenCalled();
  });
});

describe("date commune", () => {
  it("pose toutes les parties au même instant", async () => {
    await corriger({ ids: ["g1", "g2"], date: "2026-08-10T18:00:00.000Z" });
    const dates = game.update.mock.calls.map((c) => c[0].data.date.toISOString());
    expect(new Set(dates).size).toBe(1);
    expect(dates[0]).toBe("2026-08-10T18:00:00.000Z");
  });

  it("refuse une date illisible", async () => {
    expect((await corriger({ ids: ["g1"], date: "le 32 août" })).status).toBe(400);
  });
});

describe("ce qui est refusé", () => {
  it("les deux gestes à la fois", async () => {
    // L'ordre déciderait du résultat : on refuse plutôt que de choisir à la
    // place de la personne.
    const r = await corriger({ ids: ["g1"], decalageMinutes: -60, date: "2026-08-10T18:00:00Z" });
    expect(r.status).toBe(400);
  });

  it("aucun geste du tout", async () => {
    expect((await corriger({ ids: ["g1"] })).status).toBe(400);
  });

  it("une sélection vide, non textuelle, ou démesurée", async () => {
    for (const ids of [[], [42], ["g1", null], new Array(201).fill("g")]) {
      expect((await corriger({ ids, decalageMinutes: -60 })).status).toBe(400);
    }
    expect(game.update).not.toHaveBeenCalled();
  });

  it("un corps illisible", async () => {
    expect((await PATCH(requeteCassee("/api/games/dates", "PATCH"))).status).toBe(400);
  });

  it("une sélection qui ne correspond à rien du compte", async () => {
    game.findMany.mockResolvedValue([]);
    expect((await corriger({ ids: ["ailleurs"], decalageMinutes: -60 })).status).toBe(400);
    expect(game.update).not.toHaveBeenCalled();
  });
});

describe("compte rendu", () => {
  it("dit combien de parties ont bougé", async () => {
    const r = await corris({ ids: ["g1", "g2"], decalageMinutes: 60 });
    expect(r.corrigees).toBe(2);
  });
});

/** Raccourci de lecture pour le dernier test. */
async function corris(body: unknown) {
  return corps(await corriger(body));
}
