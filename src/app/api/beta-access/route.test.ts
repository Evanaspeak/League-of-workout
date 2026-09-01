import { requete, corps } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    goal: { create: jest.fn() },
  },
}));
jest.mock("@/lib/rate-limit", () => ({
  isRateLimited: jest.fn(), recordAttempt: jest.fn(), getClientIp: () => "203.0.113.7",
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";

const bride = isRateLimited as jest.Mock;
const user = prisma.user as unknown as Record<string, jest.Mock>;
const acceder = (body: unknown) => POST(requete("/api/beta-access", { method: "POST", body }));

beforeEach(() => {
  jest.clearAllMocks();
  bride.mockResolvedValue(false);
  user.count.mockResolvedValue(3);
  user.findUnique.mockResolvedValue(null);
  user.findFirst.mockResolvedValue(null);
  user.create.mockImplementation(async ({ data }: { data: unknown }) => ({ id: "u9", ...(data as object) }));
  (prisma.goal.create as jest.Mock).mockResolvedValue({});
});

/**
 * Deuxième chemin de création de compte, sans mot de passe choisi : c'est
 * l'application qui tire un code. C'est aussi le formulaire qui collecte
 * genre, âge, poids et taille.
 */
describe("POST /api/beta-access", () => {
  it("refuse quand le budget de tentatives est épuisé", async () => {
    bride.mockResolvedValue(true);
    expect((await acceder({ pseudo: "Joueur" })).status).toBe(429);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("n'exige que le pseudo", async () => {
    const r = await acceder({ pseudo: "Joueur" });
    expect(r.status).toBe(200);
    expect(user.create.mock.calls[0][0].data.email).toBeNull();
  }, 20_000);

  it("applique les mêmes règles de pseudo que les autres chemins", async () => {
    // C'est la divergence entre ces règles qui avait ouvert l'escalade
    // d'administrateur : elles vivent maintenant au même endroit.
    for (const pseudo of ["", "  ", null, "a".repeat(200)]) {
      const r = await acceder({ pseudo });
      expect(r.status).toBeGreaterThanOrEqual(400);
    }
    expect(user.create).not.toHaveBeenCalled();
  });

  it("refuse un pseudo déjà pris", async () => {
    user.findFirst.mockResolvedValue({ id: "deja" });
    expect((await acceder({ pseudo: "Joueur" })).status).toBe(409);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("refuse une adresse invalide quand elle est fournie", async () => {
    expect((await acceder({ pseudo: "Joueur", email: "pas-une-adresse" })).status).toBe(400);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("ramène l'adresse à sa forme canonique", async () => {
    await acceder({ pseudo: "Joueur", email: "Joueur@Example.COM" });
    expect(user.create.mock.calls[0][0].data.email).toBe("joueur@example.com");
  }, 20_000);

  it("refuse une adresse déjà prise", async () => {
    user.findUnique.mockResolvedValue({ id: "deja" });
    expect((await acceder({ pseudo: "Joueur", email: "a@b.fr" })).status).toBe(409);
    expect(user.create).not.toHaveBeenCalled();
  });

  /**
   * Le plafond de cent est levé.
   *
   * Il existait pour tenir le rythme des premiers jours. En pratique il a
   * surtout tenu le produit fermé pendant qu'il n'y avait personne dedans :
   * une semaine entière sans une inscription, sans une partie, sans une
   * tentative de connexion. Une porte qu'on garde contre une foule qui n'est
   * pas là ne garde rien.
   */
  it("laisse entrer la cent-unième personne", async () => {
    user.count.mockResolvedValue(100);
    expect((await acceder({ pseudo: "Joueur" })).status).toBe(200);
    expect(user.create).toHaveBeenCalled();
  });

  it("garde le rang d'arrivée, qui ne garde plus la porte", async () => {
    user.count.mockResolvedValue(423);
    await acceder({ pseudo: "Joueur" });
    expect(user.create.mock.calls[0][0].data.betaRank).toBe(424);
  });

  it("n'écrit que l'empreinte du code tiré", async () => {
    const d = await corps(await acceder({ pseudo: "Joueur" })) as { code?: string };
    const ecrit = user.create.mock.calls[0][0].data;
    expect(String(ecrit.passwordHash).startsWith("$2")).toBe(true);
    if (d.code) expect(ecrit.passwordHash).not.toBe(d.code);
  }, 20_000);

  it("range les mesures corporelles en nombres, ou en rien", async () => {
    // Ce formulaire collecte genre, âge, poids et taille. Une saisie non
    // numérique ne doit pas devenir NaN en base.
    await acceder({ pseudo: "Joueur", age: "27", poids: "beaucoup", taille: 180, genre: "femme" });
    const d = user.create.mock.calls[0][0].data;
    expect(d.age).toBe(27);
    expect(d.poids).toBeNull();
    expect(d.taille).toBe(180);
    expect(d.genre).toBe("femme");
  }, 20_000);

  it("attribue le rang suivant", async () => {
    await acceder({ pseudo: "Joueur" });
    expect(user.create.mock.calls[0][0].data.betaRank).toBe(4);
  }, 20_000);
});
