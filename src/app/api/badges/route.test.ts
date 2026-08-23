import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { aggregate: jest.fn() },
    paiement: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const p = prisma as unknown as Record<string, Record<string, jest.Mock>>;

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "u3" }));
  p.game.aggregate.mockResolvedValue({ _sum: { pompesCalculees: 620 }, _count: { _all: 30 } });
  p.paiement.findMany.mockResolvedValue([
    { jour: "2026-08-23" }, { jour: "2026-08-22" }, { jour: "2026-08-21" },
  ]);
});

it("refuse sans session", async () => {
  session.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(p.game.aggregate).not.toHaveBeenCalled();
});

it("ne compte que les parties et les paiements du demandeur", async () => {
  await GET();
  expect(p.game.aggregate.mock.calls[0][0].where).toEqual({ userId: "u3" });
  expect(p.paiement.findMany.mock.calls[0][0].where).toEqual({ userId: "u3" });
});

it("déduit les paliers des données existantes", async () => {
  const r = await corps(await GET());
  const badges = r.badges as { cle: string; obtenu: boolean }[];
  expect(badges.find((b) => b.cle === "volume500")?.obtenu).toBe(true);
  expect(badges.find((b) => b.cle === "parties25")?.obtenu).toBe(true);
  expect(badges.find((b) => b.cle === "serie3")?.obtenu).toBe(true);
  expect(badges.find((b) => b.cle === "serie7")?.obtenu).toBe(false);
});

it("survit à un compte qui n'a rien fait", async () => {
  // `_sum` rend `null` sur une table vide : le prendre pour zéro n'est pas
  // automatique, et une somme absente ferait tomber le calcul.
  p.game.aggregate.mockResolvedValue({ _sum: { pompesCalculees: null }, _count: { _all: 0 } });
  p.paiement.findMany.mockResolvedValue([]);
  const r = await corps(await GET());
  expect((r.source as { totalPoints: number }).totalPoints).toBe(0);
  expect(r.prochain).not.toBeNull();
});
