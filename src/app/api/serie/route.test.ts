import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { paiement: { findMany: jest.fn() } } }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const findMany = (prisma as unknown as { paiement: { findMany: jest.Mock } }).paiement.findMany;

const lire = (jour?: string) =>
  GET(requete(`/api/serie${jour ? `?jour=${jour}` : ""}`));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ dettePointsDus: 0, detteDepuis: null }));
  findMany.mockResolvedValue([]);
});

describe("accès", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await lire()).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("ne lit que les paiements du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u9" }));
    await lire();
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: "u9" });
  });
});

describe("série", () => {
  it("compte les jours consécutifs jusqu'au jour demandé", async () => {
    findMany.mockResolvedValue([
      { jour: "2026-08-23" }, { jour: "2026-08-22" }, { jour: "2026-08-21" },
    ]);
    const r = await corps(await lire("2026-08-23"));
    expect(r.serie).toBe(3);
    expect(r.payeAujourdhui).toBe(true);
  });

  it("prend le jour du navigateur, pas celui du serveur", async () => {
    // Quelqu'un qui paie à une heure du matin verrait sinon sa série comptée
    // sur la veille ou le lendemain selon son fuseau.
    findMany.mockResolvedValue([{ jour: "2026-08-22" }]);
    expect((await corps(await lire("2026-08-23"))).serie).toBe(1);
    expect((await corps(await lire("2026-08-30"))).serie).toBe(0);
  });

  it("ignore un jour mal formé au lieu de casser", async () => {
    findMany.mockResolvedValue([]);
    expect((await lire("hier")).status).toBe(200);
  });
});

describe("retard", () => {
  it("ne signale rien sur une dette éteinte, même ancienne", async () => {
    session.mockResolvedValue(utilisateur({
      dettePointsDus: 0,
      detteDepuis: new Date(Date.now() - 10 * 86_400_000),
    }));
    expect((await corps(await lire())).enRetard).toBe(false);
  });

  it("le signale au-delà de trois jours de dette en cours", async () => {
    session.mockResolvedValue(utilisateur({
      dettePointsDus: 42,
      detteDepuis: new Date(Date.now() - 4 * 86_400_000),
    }));
    const r = await corps(await lire());
    expect(r.enRetard).toBe(true);
    expect(r.joursDeRetard).toBe(4);
  });
});
