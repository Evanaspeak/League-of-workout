import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { demandeJeu: { count: jest.fn(), createMany: jest.fn() } },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { DEMANDES_MAX } from "@/lib/demandeJeu";

const session = getCurrentUser as jest.Mock;
const count = (prisma as unknown as { demandeJeu: { count: jest.Mock } }).demandeJeu.count;
const createMany =
  (prisma as unknown as { demandeJeu: { createMany: jest.Mock } }).demandeJeu.createMany;

const requete = (body: unknown) =>
  new Request("http://x/api/jeux/demande", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "u1" }));
  count.mockResolvedValue(0);
  createMany.mockResolvedValue({ count: 1 });
});

describe("accès", () => {
  it("refuse sans session, et n'écrit rien", async () => {
    session.mockResolvedValue(null);
    expect((await POST(requete({ nom: "Zelda" }))).status).toBe(401);
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe("ce qu'on refuse", () => {
  it("un corps illisible", async () => {
    const r = await POST(new Request("http://x", { method: "POST", body: "{pas du json" }));
    expect(r.status).toBe(400);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("un nom vide, et un jeu déjà au catalogue", async () => {
    expect((await POST(requete({ nom: "  " }))).status).toBe(400);
    const r = await POST(requete({ nom: "league of legends" }));
    expect(r.status).toBe(400);
    expect((await corps(r)).error).toBe("Ce jeu est déjà au catalogue");
    expect(createMany).not.toHaveBeenCalled();
  });

  it("au-delà du plafond par compte", async () => {
    // Le plafond remplace la modération : sans lui, un seul compte décide de
    // la suite du catalogue.
    count.mockResolvedValue(DEMANDES_MAX);
    expect((await POST(requete({ nom: "Zelda" }))).status).toBe(429);
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe("ce qu'on écrit", () => {
  it("le nom tapé et sa forme repliée, sous le compte courant", async () => {
    await POST(requete({ nom: "  Dead by   Daylight " }));
    expect(createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", nom: "Dead by Daylight", cle: "dead by daylight" }],
      skipDuplicates: true,
    });
  });

  it("laisse la BASE trancher le doublon, pas le code", async () => {
    // Deux envois partis en même temps liraient tous deux « pas encore
    // demandé » : c'est l'unicité en base qui garantit un compte de PERSONNES,
    // et `skipDuplicates` fait du renvoi un succès plutôt qu'une erreur.
    await POST(requete({ nom: "Zelda" }));
    expect(createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("compte les demandes du seul compte courant", async () => {
    await POST(requete({ nom: "Zelda" }));
    expect(count).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });
});
