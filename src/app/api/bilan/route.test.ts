import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findMany: jest.fn() },
    paiement: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const game = prisma.game as unknown as { findMany: jest.Mock };
const paiement = prisma.paiement as unknown as { findMany: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ pseudo: "Kira", exercices: ["pompes"], fuseau: "Europe/Paris" }));
  game.findMany.mockResolvedValue([]);
  paiement.findMany.mockResolvedValue([]);
});

const lire = () => GET();

describe("GET /api/bilan", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await lire()).status).toBe(401);
  });

  it("ne lit que les données du compte courant", async () => {
    await lire();
    expect(game.findMany.mock.calls[0][0].where.userId).toBe(utilisateur().id);
    expect(paiement.findMany.mock.calls[0][0].where.userId).toBe(utilisateur().id);
  });

  it("ne remonte jamais plus de quatre-vingt-dix jours", async () => {
    await lire();
    const depuis = game.findMany.mock.calls[0][0].where.date.gte as Date;
    const jours = (Date.now() - depuis.getTime()) / 86_400_000;
    expect(jours).toBeGreaterThan(89.9);
    expect(jours).toBeLessThan(90.1);
  });

  it("rend les totaux de la période", async () => {
    game.findMany.mockResolvedValue([
      { date: new Date(), result: "V", pompesCalculees: 30, jeu: "Valorant", champion: "Jett" },
      { date: new Date(), result: "D", pompesCalculees: 10, jeu: "Valorant", champion: "Sage" },
    ]);
    paiement.findMany.mockResolvedValue([{ points: 25, jour: "2026-08-20" }]);
    const b = await corps(await lire());
    expect(b.parties).toBe(2);
    expect(b.victoires).toBe(1);
    expect(b.winrate).toBe(50);
    expect(b.pointsDus).toBe(40);
    expect(b.pointsPayes).toBe(25);
    expect(b.jeuPrincipal).toEqual({ nom: "Valorant", parties: 2 });
  });

  it("convertit l'effort payé dans les exercices du compte", async () => {
    // « 4 200 points » ne dit rien à personne, et c'est une image qu'on montre.
    paiement.findMany.mockResolvedValue([{ points: 40, jour: "2026-08-20" }]);
    const b = await corps(await lire()) as { repartitionPayee: Record<string, number> };
    expect(b.repartitionPayee.pompes).toBe(40);
  });

  it("porte le pseudo, qui figure sur l'image", async () => {
    expect((await corps(await lire())).pseudo).toBe("Kira");
  });

  it("ne publie rien d'autre du compte", async () => {
    // La réponse alimente une image qu'on montre à des inconnus : tout champ
    // qui traîne ici finit à l'écran de quelqu'un d'autre.
    const b = await corps(await lire());
    for (const interdit of ["email", "passwordHash", "id", "riotPuuid", "jetonObs", "fuseau"]) {
      expect(b[interdit]).toBeUndefined();
    }
  });
});
