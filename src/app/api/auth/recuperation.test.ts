import { requete, corps } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    verificationToken: { findFirst: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
  },
}));
jest.mock("@/lib/rate-limit", () => ({
  isRateLimited: jest.fn(), recordAttempt: jest.fn(), getClientIp: () => "203.0.113.7",
}));
jest.mock("@/lib/email", () => ({ sendResetLink: jest.fn().mockResolvedValue(undefined) }));

import { POST as demander } from "./forgot-code/route";
import { POST as valider } from "./reset-code/route";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { sendResetLink } from "@/lib/email";

const bride = isRateLimited as jest.Mock;
const user = prisma.user as unknown as Record<string, jest.Mock>;
const jetons = prisma.verificationToken as unknown as Record<string, jest.Mock>;

const dmd = (body: unknown) => demander(requete("/api/auth/forgot-code", { method: "POST", body }));
const val = (body: unknown) => valider(requete("/api/auth/reset-code", { method: "POST", body }));
const JETON = "j".repeat(43);

beforeEach(() => {
  jest.clearAllMocks();
  bride.mockResolvedValue(false);
  user.findUnique.mockResolvedValue({ id: "u1", pseudo: "Joueur", passwordHash: "$2a$ancien" });
  user.update.mockResolvedValue({});
  jetons.deleteMany.mockResolvedValue({ count: 1 });
  jetons.create.mockResolvedValue({});
  jetons.findFirst.mockResolvedValue({
    identifier: "reset:joueur@example.com",
    token: "empreinte",
    expires: new Date(Date.now() + 3_600_000),
  });
});

/**
 * La récupération de compte est le chemin qu'emprunte aussi celui qui veut
 * prendre le compte de quelqu'un d'autre. Trois défauts en sont sortis : une
 * réponse qui disait si l'adresse existait, un mot de passe remplacé sur la
 * seule demande, et des sessions qui survivaient à la reprise en main.
 */
describe("POST /api/auth/forgot-code", () => {
  it("répond pareil que l'adresse existe ou non", async () => {
    // Une réponse différente permettrait d'énumérer les comptes.
    const connue = await dmd({ email: "joueur@example.com" });
    user.findUnique.mockResolvedValue(null);
    const inconnue = await dmd({ email: "personne@example.com" });
    expect(connue.status).toBe(inconnue.status);
    expect(await corps(connue)).toEqual(await corps(inconnue));
  });

  it("répond pareil pour un compte sans mot de passe", async () => {
    // Sinon la réponse dirait qui s'est inscrit par Google ou Discord.
    user.findUnique.mockResolvedValue({ id: "u1", pseudo: "Joueur", passwordHash: null });
    const r = await dmd({ email: "joueur@example.com" });
    expect(r.status).toBe(200);
    expect(sendResetLink).not.toHaveBeenCalled();
  });

  it("ne touche jamais au mot de passe à la demande", async () => {
    // Il était remplacé sur-le-champ : connaître l'adresse de quelqu'un
    // suffisait à lui faire tourner son identifiant sans qu'il ait rien
    // demandé, pendant que l'e-mail lui promettait le contraire.
    await dmd({ email: "joueur@example.com" });
    expect(user.update).not.toHaveBeenCalled();
    expect(sendResetLink).toHaveBeenCalled();
  });

  it("n'écrit jamais le jeton en clair", async () => {
    await dmd({ email: "joueur@example.com" });
    const ecrit = jetons.create.mock.calls[0][0].data;
    const lien = (sendResetLink as jest.Mock).mock.calls[0][2] as string;
    expect(lien).toContain("t=");
    const envoye = decodeURIComponent(lien.split("t=")[1]);
    expect(ecrit.token).not.toBe(envoye);
    expect(envoye.length).toBeGreaterThan(20);
  });

  it("remplace une demande en cours plutôt que d'en empiler une seconde", async () => {
    await dmd({ email: "joueur@example.com" });
    expect(jetons.deleteMany).toHaveBeenCalledWith({ where: { identifier: "reset:joueur@example.com" } });
  });

  it("refuse une adresse invalide", async () => {
    for (const email of ["pas-une-adresse", "", null]) {
      expect((await dmd({ email })).status).toBe(400);
    }
    expect(jetons.create).not.toHaveBeenCalled();
  });

  it("compte le budget sur l'adresse réseau et sur l'adresse e-mail", async () => {
    // Sur l'IP seule, un attaquant change de réseau ; sur l'e-mail seul, il
    // balaie les adresses. Les deux compteurs sont nécessaires.
    bride.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect((await dmd({ email: "joueur@example.com" })).status).toBe(429);
    expect(jetons.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-code", () => {
  it("refuse un jeton trop court ou absent", async () => {
    for (const token of ["", "court", null, 42]) {
      expect((await val({ token })).status).toBe(400);
    }
    expect(user.update).not.toHaveBeenCalled();
  });

  it("refuse un jeton inconnu", async () => {
    jetons.findFirst.mockResolvedValue(null);
    expect((await val({ token: JETON })).status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("refuse un jeton expiré et le supprime", async () => {
    jetons.findFirst.mockResolvedValue({
      identifier: "reset:joueur@example.com", token: "empreinte",
      expires: new Date(Date.now() - 1000),
    });
    expect((await val({ token: JETON })).status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
    expect(jetons.deleteMany).toHaveBeenCalled();
  });

  it("remplace le code et rend le nouveau", async () => {
    const d = await corps(await val({ token: JETON })) as { code: string; pseudo: string };
    expect(d.pseudo).toBe("Joueur");
    expect(d.code.length).toBeGreaterThan(3);
    const ecrit = user.update.mock.calls[0][0].data;
    expect(ecrit.passwordHash).not.toBe(d.code);
    expect(String(ecrit.passwordHash).startsWith("$2")).toBe(true);
  }, 20_000);

  it("périme les sessions ouvertes avec l'ancien code", async () => {
    // Sans ça, récupérer son compte ne met pas dehors qui s'y trouvait déjà.
    await val({ token: JETON });
    expect(user.update.mock.calls[0][0].data.sessionEpoch).toEqual({ increment: 1 });
  }, 20_000);

  it("consomme le lien, qui ne resservira pas", async () => {
    await val({ token: JETON });
    expect(jetons.deleteMany).toHaveBeenCalledWith({ where: { token: "empreinte" } });
  }, 20_000);

  it("refuse un lien qui pointe vers un compte sans mot de passe", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", pseudo: "Joueur", passwordHash: null });
    expect((await val({ token: JETON })).status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
  });
});
