import { requete, corps } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { user: { count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() } },
}));
jest.mock("@/lib/rate-limit", () => ({
  isRateLimited: jest.fn(), recordAttempt: jest.fn(), getClientIp: () => "203.0.113.7",
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

const bride = isRateLimited as jest.Mock;
const user = prisma.user as unknown as Record<string, jest.Mock>;

const inscrire = (body: unknown) => POST(requete("/api/auth/register", { method: "POST", body }));
const VALIDE = { email: "Nouveau@Example.COM", password: "motdepasse-long", pseudo: "Nouveau" };

beforeEach(() => {
  jest.clearAllMocks();
  bride.mockResolvedValue(false);
  user.count.mockResolvedValue(3);
  user.findUnique.mockResolvedValue(null);
  user.findFirst.mockResolvedValue(null);
  user.create.mockImplementation(async ({ data }: { data: unknown }) => ({ id: "u9", ...(data as object) }));
});

/**
 * L'inscription est la seule route qui crée une identité. Deux incidents en
 * viennent : une adresse acceptée dans deux casses différentes, et une porte
 * ouverte sans limite de débit.
 */
describe("POST /api/auth/register", () => {
  it("compte la tentative sur l'adresse réseau", async () => {
    await inscrire(VALIDE);
    expect(recordAttempt).toHaveBeenCalledWith("203.0.113.7", "register");
  });

  it("refuse quand le budget de tentatives est épuisé", async () => {
    bride.mockResolvedValue(true);
    expect((await inscrire(VALIDE)).status).toBe(429);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("ramène l'adresse à sa forme canonique avant tout", async () => {
    // L'index unique compare octet par octet, le test d'administrateur compare
    // sans la casse : une variante de casse passait l'un et satisfaisait
    // l'autre. C'était le chemin d'escalade.
    await inscrire(VALIDE);
    expect(user.findUnique.mock.calls[0][0].where.email).toBe("nouveau@example.com");
    expect(user.create.mock.calls[0][0].data.email).toBe("nouveau@example.com");
  });

  it("refuse une adresse invalide", async () => {
    for (const email of ["pas-une-adresse", "", null, 42, "a@b"]) {
      const r = await inscrire({ ...VALIDE, email });
      expect(r.status).toBe(400);
    }
    expect(user.create).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe trop court", async () => {
    const r = await inscrire({ ...VALIDE, password: "court" });
    expect(r.status).toBe(400);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe qui n'est pas une chaîne", async () => {
    expect((await inscrire({ ...VALIDE, password: 12345678 })).status).toBe(400);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("n'écrit jamais le mot de passe en clair", async () => {
    await inscrire(VALIDE);
    const ecrit = user.create.mock.calls[0][0].data;
    expect(ecrit.password).toBeUndefined();
    expect(ecrit.passwordHash).not.toBe(VALIDE.password);
    expect(String(ecrit.passwordHash).startsWith("$2")).toBe(true);
  }, 20_000);

  it("refuse une adresse déjà prise", async () => {
    user.findUnique.mockResolvedValue({ id: "deja" });
    expect((await inscrire(VALIDE)).status).toBe(409);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("refuse un pseudo déjà pris", async () => {
    user.findFirst.mockResolvedValue({ id: "deja" });
    expect((await inscrire(VALIDE)).status).toBe(409);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("refuse quand les cent places sont prises", async () => {
    user.count.mockResolvedValue(100);
    expect((await inscrire(VALIDE)).status).toBe(403);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("attribue le rang suivant", async () => {
    await inscrire(VALIDE);
    expect(user.create.mock.calls[0][0].data.betaRank).toBe(4);
  }, 20_000);

  it("ne rend jamais l'empreinte dans sa réponse", async () => {
    const brut = JSON.stringify(await corps(await inscrire(VALIDE)));
    expect(brut).not.toContain("$2");
  }, 20_000);
});
