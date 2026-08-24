import { requete, corps, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    goal: { upsert: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/seed-defaults", () => ({ seedDefaults: jest.fn().mockResolvedValue(undefined) }));

import { GET, PUT, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const user = prisma.user as unknown as { update: jest.Mock; findFirst: jest.Mock };
const goal = prisma.goal as unknown as { upsert: jest.Mock };

const put = (body: unknown) => PUT(requete("/api/user", { method: "PUT", body }));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ passwordHash: "$2a$secret", pompesMax: 20 }));
  user.update.mockImplementation(async ({ data }: { data: unknown }) => ({ id: "u1", ...(data as object) }));
  user.findFirst.mockResolvedValue(null);
  goal.upsert.mockResolvedValue({});
});

describe("GET /api/user", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("ne laisse jamais sortir l'empreinte du mot de passe", async () => {
    const d = await corps(await GET());
    expect(d.passwordHash).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain("$2a$secret");
  });

  it("dit au navigateur s'il parle à un administrateur", async () => {
    // Le navigateur ne connaît pas la liste des adresses : c'est le serveur
    // qui tranche, et plusieurs écrans s'appuient sur cette réponse.
    expect((await corps(await GET())).estAdmin).toBe(false);
    session.mockResolvedValue(admin({ passwordHash: null }));
    expect((await corps(await GET())).estAdmin).toBe(true);
  });
});

describe("PUT /api/user", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await put({ pseudo: "Truc" })).status).toBe(401);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("n'écrit que sur le compte du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await put({ pseudo: "Truc" });
    expect(user.update.mock.calls[0][0].where).toEqual({ id: "u42" });
  });

  it("refuse un pseudo déjà pris", async () => {
    user.findFirst.mockResolvedValue({ id: "autre" });
    expect((await put({ pseudo: "Truc" })).status).toBe(409);
  });

  it("refuse une région inconnue", async () => {
    const r = await put({ riotRegion: "mars1" });
    expect(r.status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("refuse un PUUID mal formé", async () => {
    // Il partait autrefois tel quel dans l'URL appelée chez Riot, avec la clé
    // du serveur : une valeur non validée s'y invitait.
    const r = await put({ riotPuuid: "../../admin?x=" });
    expect(r.status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("refuse un objectif qui n'est pas un nombre", async () => {
    const r = await put({ objectifTotalPompes: "beaucoup" });
    expect(r.status).toBe(400);
    expect(goal.upsert).not.toHaveBeenCalled();
  });

  it("refuse un objectif nul ou négatif", async () => {
    for (const v of [0, -50]) {
      expect((await put({ objectifTotalPompes: v })).status).toBe(400);
    }
    expect(goal.upsert).not.toHaveBeenCalled();
  });

  it("enregistre un objectif raisonnable, arrondi", async () => {
    const r = await put({ objectifTotalPompes: 1500.7 });
    expect(r.status).toBe(200);
    expect(goal.upsert.mock.calls[0][0].update.objectifTotalPompes).toBe(1501);
  });
});

/**
 * La suppression de son propre compte.
 *
 * Elle passait par une action serveur, et c'est ce qui la rendait muette : le
 * client Next ne rejette pas la promesse quand l'action répond mal, il remonte
 * l'erreur à la page. Le `await` ne rendait jamais la main, et l'écran restait
 * bloqué sur « Suppression… » — mesuré au navigateur avant de déplacer.
 */
describe("DELETE /api/user", () => {
  it("refuse sans session", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);
    const r = await DELETE();
    expect(r.status).toBe(401);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("n'efface que le compte du demandeur", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(utilisateur({ id: "moi" }));
    (prisma.user.delete as jest.Mock).mockResolvedValue({});
    const r = await DELETE();
    expect(r.status).toBe(200);
    expect(await corps(r)).toEqual({ supprime: true });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "moi" } });
  });
});
