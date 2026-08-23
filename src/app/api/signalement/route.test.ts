import { requete, requeteCassee, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    signalement: { create: jest.fn() },
    loginAttempt: {
      count: jest.fn(), create: jest.fn(), deleteMany: jest.fn(),
    },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const p = prisma as unknown as Record<string, Record<string, jest.Mock>>;

const envoyer = (body: unknown) =>
  POST(requete("/api/signalement", { method: "POST", body }));

const VALIDE = {
  message: "Le compteur de dette reste à zéro après une défaite.",
  page: "/dashboard",
  contexte: { version: "0.9.4", bureau: true, langue: "fr", ecran: "3440x1440" },
};

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(null);
  p.signalement.create.mockResolvedValue({ id: "s1" });
  p.loginAttempt.count.mockResolvedValue(0);
  p.loginAttempt.create.mockResolvedValue({});
  p.loginAttempt.deleteMany.mockResolvedValue({});
});

describe("sans session", () => {
  it("accepte quand même : c'est tout l'intérêt", async () => {
    // Un problème sur l'écran de connexion est le pire de tous. Exiger une
    // session pour le signaler ferait l'inverse de ce qu'on cherche.
    const r = await envoyer(VALIDE);
    expect(r.status).toBe(201);
    expect(p.signalement.create.mock.calls[0][0].data.userId).toBeNull();
  });
});

describe("avec session", () => {
  it("rattache le signalement au compte de la session", async () => {
    session.mockResolvedValue(utilisateur({ id: "u7" }));
    await envoyer(VALIDE);
    expect(p.signalement.create.mock.calls[0][0].data.userId).toBe("u7");
  });

  it("ignore un userId envoyé par le client", async () => {
    // Sinon n'importe qui signe un signalement au nom d'un autre.
    session.mockResolvedValue(utilisateur({ id: "u7" }));
    await envoyer({ ...VALIDE, userId: "victime" });
    expect(p.signalement.create.mock.calls[0][0].data.userId).toBe("u7");
  });
});

describe("ce qui est refusé", () => {
  it("un message vide ou trop court", async () => {
    for (const message of ["", "   ", "bug"]) {
      expect((await envoyer({ ...VALIDE, message })).status).toBe(400);
    }
    expect(p.signalement.create).not.toHaveBeenCalled();
  });

  it("un corps illisible", async () => {
    expect((await POST(requeteCassee("/api/signalement"))).status).toBe(400);
    expect(p.signalement.create).not.toHaveBeenCalled();
  });

  it("un déluge depuis la même adresse", async () => {
    p.loginAttempt.count.mockResolvedValue(5);
    expect((await envoyer(VALIDE)).status).toBe(429);
    expect(p.signalement.create).not.toHaveBeenCalled();
  });
});

describe("ce qui est gardé, et ce qui ne l'est pas", () => {
  it("coupe les paramètres de l'adresse", async () => {
    // Ils portent parfois un jeton de récupération, et cette table se relit
    // des mois plus tard.
    await envoyer({ ...VALIDE, page: "/recuperation/valider?code=SECRET123&x=1" });
    expect(p.signalement.create.mock.calls[0][0].data.page).toBe("/recuperation/valider");
  });

  it("ne garde du contexte que les clés prévues", async () => {
    // La page qui remplit ce champ est du code client, donc modifiable : rien
    // n'empêcherait d'y glisser le contenu d'un formulaire.
    await envoyer({
      ...VALIDE,
      contexte: { version: "0.9.4", motDePasse: "hunter2", contenuDuFormulaire: "…" },
    });
    const garde = JSON.parse(p.signalement.create.mock.calls[0][0].data.contexte);
    expect(garde).toEqual({ version: "0.9.4" });
  });

  it("tronque un message démesuré au lieu de le refuser", async () => {
    await envoyer({ ...VALIDE, message: "a".repeat(9000) });
    expect(p.signalement.create.mock.calls[0][0].data.message).toHaveLength(2000);
  });

  it("ne retient pas une page absente comme chaîne vide", async () => {
    await envoyer({ ...VALIDE, page: undefined });
    expect(p.signalement.create.mock.calls[0][0].data.page).toBe("/");
  });
});
