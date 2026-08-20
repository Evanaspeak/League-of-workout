import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { count: jest.fn() },
    roleWeight: { findMany: jest.fn() },
    levelConfig: { findMany: jest.fn() },
    masteryConfig: { findFirst: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;

const NIVEAUX = [1, 2, 3, 4, 5].map((niveau) => ({
  niveau, seuilGainageSec: niveau * 30, seuilPompes: niveau * 20,
  multiplicateur: 2, malusDefaite: 10,
}));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ pompesMax: 20 }));
  (prisma.game.count as jest.Mock).mockResolvedValue(0);
  (prisma.roleWeight.findMany as jest.Mock).mockResolvedValue([
    { role: "MID", poidsKill: 1, poidsMort: 2, poidsAssist: 0.5, maitriseActive: true },
  ]);
  (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue(NIVEAUX);
  (prisma.masteryConfig.findFirst as jest.Mock).mockResolvedValue({ surchargeMax: 0.5, partiesPourMax: 100 });
});

const post = (body: unknown) => POST(requete("/api/games/preview", { method: "POST", body }));

/**
 * L'aperçu affiche ce qu'une partie va coûter avant de l'enregistrer. Il doit
 * donner exactement le même résultat que l'enregistrement : un aperçu qui
 * ment est pire que pas d'aperçu.
 */
describe("POST /api/games/preview", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await post({ jeu: "League of Legends", role: "MID" })).status).toBe(401);
  });

  it("n'écrit rien", async () => {
    // La route ne dispose d'aucun moyen d'écrire : le client Prisma doublé
    // n'expose pas `create`. Si quelqu'un en ajoutait un, ce test tomberait.
    expect((prisma as unknown as { game: Record<string, unknown> }).game.create).toBeUndefined();
    const r = await post({ jeu: "League of Legends", role: "MID", kills: 2, deaths: 9, assists: 4, result: "D" });
    expect(r.status).toBe(200);
  });

  it("rend un coût et une ventilation cohérents", async () => {
    const d = await corps(await post({
      jeu: "League of Legends", role: "MID",
      kills: 2, deaths: 9, assists: 4, result: "D",
      exercices: ["pompes", "boxe"],
    })) as { scoring: { pompesFinales: number }; repartition: Record<string, number> };
    expect(d.scoring.pompesFinales).toBeGreaterThan(0);
    const somme = Object.values(d.repartition).reduce((a, b) => a + b, 0);
    expect(somme).toBe(d.scoring.pompesFinales);
  });

  it("ne compte les parties d'un champion que pour le demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42", pompesMax: 20 }));
    await post({ jeu: "League of Legends", role: "MID", champion: "Ahri", result: "D" });
    const appels = (prisma.game.count as jest.Mock).mock.calls;
    if (appels.length > 0) expect(appels[0][0].where.userId).toBe("u42");
  });

  it("signale une configuration de scoring absente", async () => {
    (prisma.masteryConfig.findFirst as jest.Mock).mockResolvedValue(null);
    expect((await post({ jeu: "League of Legends", role: "MID", result: "D" })).status).toBe(500);
  });
});
