import { requete, corps } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    goal: { create: jest.fn() },
    amitie: { create: jest.fn() },
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
  (prisma.amitie.create as jest.Mock).mockResolvedValue({});
});

/**
 * Le parrainage, à la seule occasion où il se pose.
 *
 * `findUnique` sert déjà à chercher une adresse : la doublure répond donc au
 * `where` qu'on lui donne, sinon un test du parrainage rendrait un compte pour
 * une recherche d'e-mail et l'inverse.
 */
describe("le parrainage", () => {
  const parParrain = (parrain: { id: string } | null) => {
    (prisma.user.findUnique as jest.Mock).mockImplementation(
      async ({ where }: { where: { codeParrain?: string } }) =>
        (where.codeParrain ? parrain : null));
  };
  const amitie = () => prisma.amitie.create as jest.Mock;

  it("lie le compte au parrain et les rend amis tout de suite", async () => {
    parParrain({ id: "parrain" });
    const r = await acceder({ pseudo: "Filleul", parrain: "ABCD2345" });
    expect(r.status).toBe(200);
    expect(user.create.mock.calls[0][0].data.parrainId).toBe("parrain");
    expect(amitie().mock.calls[0][0].data).toEqual({
      demandeurId: "parrain", receveurId: "u9",
      etat: "acceptee", accepteeLe: expect.any(Date),
    });
  }, 20_000);

  it("cherche le parrain par son code, jamais par autre chose", async () => {
    parParrain({ id: "parrain" });
    await acceder({ pseudo: "Filleul", parrain: "abcd-2345" });
    const appels = (prisma.user.findUnique as jest.Mock).mock.calls
      .map((a) => a[0].where)
      .filter((w) => "codeParrain" in w);
    expect(appels).toEqual([{ codeParrain: "ABCD2345" }]);
  }, 20_000);

  /**
   * La règle qui gouverne toutes les autres : un code fautif ne fait jamais
   * échouer l'inscription. Un lien tronqué par un client de messagerie doit
   * laisser passer le compte — refuser reviendrait à perdre exactement celui
   * qu'on venait de convaincre.
   */
  it.each([
    ["absent", undefined],
    ["illisible", "trop-court"],
    ["inconnu", "ZZZZ9999"],
  ])("un code %s crée quand même le compte, sans parrain ni amitié", async (_, code) => {
    parParrain(null);
    const r = await acceder({ pseudo: "Filleul", parrain: code });
    expect(r.status).toBe(200);
    expect(user.create.mock.calls[0][0].data.parrainId).toBeNull();
    expect(amitie()).not.toHaveBeenCalled();
  }, 20_000);

  /**
   * L'amitié qui ne s'écrit pas ne coûte qu'elle-même : le compte existe, le
   * lien est posé, et l'amitié se redemande à la main. L'inverse — refuser le
   * compte — serait la pire des deux.
   */
  it("une amitié qui échoue ne fait pas échouer l'inscription", async () => {
    parParrain({ id: "parrain" });
    amitie().mockRejectedValue(new Error("base HS"));
    const r = await acceder({ pseudo: "Filleul", parrain: "ABCD2345" });
    expect(r.status).toBe(200);
    expect(user.create.mock.calls[0][0].data.parrainId).toBe("parrain");
  }, 20_000);
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
