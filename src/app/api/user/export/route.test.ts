import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findMany: jest.fn() },
    goal: { findUnique: jest.fn() },
    pushSubscription: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({
    passwordHash: "$2a$empreinte-secrete",
    sessionEpoch: 7,
    riotPuuid: "PUUID-SECRET-1234",
    poids: 75, taille: 180, age: 27, genre: "homme",
    createdAt: new Date("2026-06-01"), betaRank: 3,
  }));
  (prisma.game.findMany as jest.Mock).mockResolvedValue([
    { id: "g1", userId: "u1", date: new Date(), pompesCalculees: 38, exercice: "pompes" },
  ]);
  (prisma.goal.findUnique as jest.Mock).mockResolvedValue({ objectifTotalPompes: 1000 });
  (prisma.pushSubscription.findMany as jest.Mock).mockResolvedValue([{ createdAt: new Date() }]);
});

/**
 * L'export sert le droit à la portabilité : il doit être complet. Mais il
 * traverse le réseau et finit dans un fichier sur un disque, donc il ne doit
 * contenir aucun secret. Les deux exigences tirent en sens contraire, et c'est
 * exactement ce que ces tests surveillent.
 */
describe("GET /api/user/export", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("n'exporte que les données du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await GET();
    for (const appel of [
      (prisma.game.findMany as jest.Mock).mock.calls[0][0],
      (prisma.goal.findUnique as jest.Mock).mock.calls[0][0],
      (prisma.pushSubscription.findMany as jest.Mock).mock.calls[0][0],
    ]) {
      expect(JSON.stringify(appel)).toContain("u42");
    }
  });

  it("ne laisse sortir aucun secret", async () => {
    const brut = JSON.stringify(await corps(await GET()));
    for (const secret of ["$2a$empreinte-secrete", "PUUID-SECRET-1234", "sessionEpoch", "passwordHash"]) {
      expect(brut).not.toContain(secret);
    }
  });

  it("inclut les données de santé collectées", async () => {
    // Poids, taille, âge et genre sont collectés à l'inscription. Le droit à
    // la portabilité porte sur eux comme sur le reste.
    const d = await corps(await GET()) as { compte: Record<string, unknown> };
    expect(d.compte.poids).toBe(75);
    expect(d.compte.taille).toBe(180);
    expect(d.compte.age).toBe(27);
    expect(d.compte.genre).toBe("homme");
  });

  it("inclut l'historique des parties", async () => {
    const d = await corps(await GET()) as Record<string, unknown>;
    const brut = JSON.stringify(d);
    expect(brut).toContain("38");
  });

  it("n'expose des abonnements que la date, jamais la clé", async () => {
    // Un abonnement aux notifications porte une clé qui permet d'envoyer un
    // message au navigateur : elle n'a rien à faire dans un fichier exporté.
    await GET();
    const appel = (prisma.pushSubscription.findMany as jest.Mock).mock.calls[0][0];
    expect(Object.keys(appel.select)).toEqual(["createdAt"]);
  });
});
