import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { paiement: { findMany: jest.fn() } },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jourLocal } from "@/lib/serie";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as { paiement: { findMany: jest.Mock } };

const jourIlYA = (n: number) => jourLocal(new Date(Date.now() - n * 86_400_000));
const p = (id: string, points: number, jours: number) =>
  ({ id, points, jour: jourIlYA(jours), createdAt: new Date(Date.now() - jours * 86_400_000) });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
});

it("refuse sans session, et ne lit rien", async () => {
  session.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(db.paiement.findMany).not.toHaveBeenCalled();
});

it("filtre les paiements sur le compte", async () => {
  db.paiement.findMany.mockResolvedValue([]);
  await GET();
  expect(db.paiement.findMany.mock.calls[0][0].where).toEqual({ userId: "moi" });
});

it("sans aucune séance, il n'y a rien à proposer", async () => {
  db.paiement.findMany.mockResolvedValue([]);
  expect(await corps(await GET())).toMatchObject({ partageable: false, points: 0 });
});

it("une séance record au-dessus du plancher se propose", async () => {
  db.paiement.findMany.mockResolvedValue([p("a", 250, 0), p("b", 120, 3)]);
  expect(await corps(await GET())).toMatchObject({ partageable: true, points: 250 });
});

it("une séance battue dans la fenêtre ne se propose pas", async () => {
  db.paiement.findMany.mockResolvedValue([p("a", 150, 0), p("b", 300, 3)]);
  expect(await corps(await GET())).toMatchObject({ partageable: false, points: 150 });
});

it("un record HORS fenêtre ne compte pas", async () => {
  // Sans la borne, la plus grosse séance de toujours empêcherait à jamais d'en
  // proposer une autre : c'est le défaut du classement cumulatif, appliqué ici.
  db.paiement.findMany.mockResolvedValue([p("a", 150, 0), p("b", 900, 45)]);
  expect(await corps(await GET())).toMatchObject({ partageable: true, points: 150 });
});

it("sous le plancher, rien ne se propose", async () => {
  db.paiement.findMany.mockResolvedValue([p("a", 12, 0)]);
  expect(await corps(await GET())).toMatchObject({ partageable: false, points: 12 });
});
