import { requete, requeteCassee, corps, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { signalement: { findMany: jest.fn(), update: jest.fn() } },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const p = prisma as unknown as { signalement: Record<string, jest.Mock> };

const patcher = (body: unknown) =>
  PATCH(requete("/api/admin/signalements", { method: "PATCH", body }));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(admin());
  p.signalement.findMany.mockResolvedValue([]);
  p.signalement.update.mockResolvedValue({});
});

describe("accès", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(403);
    expect((await patcher({ id: "s1", statut: "traite" })).status).toBe(403);
    expect(p.signalement.update).not.toHaveBeenCalled();
  });

  it("refuse un compte connecté qui n'est pas administrateur", async () => {
    session.mockResolvedValue(utilisateur());
    expect((await GET()).status).toBe(403);
    expect((await patcher({ id: "s1", statut: "traite" })).status).toBe(403);
    expect(p.signalement.findMany).not.toHaveBeenCalled();
  });
});

describe("lecture", () => {
  it("ne fait pas sortir l'adresse électronique de l'auteur", async () => {
    // Le pseudo suffit à le retrouver dans la liste des comptes. Une adresse
    // n'a pas à traverser une liste qu'on garde ouverte dans un onglet.
    p.signalement.findMany.mockResolvedValue([{
      id: "s1", createdAt: new Date(), message: "…", page: "/dashboard",
      contexte: '{"version":"0.9.4"}', statut: "ouvert",
      user: { pseudo: "Joueur" },
    }]);
    const texte = JSON.stringify(await corps(await GET()));
    expect(texte).toContain("Joueur");
    expect(texte).not.toMatch(/@/);
    // La demande elle-même ne doit pas réclamer l'adresse.
    expect(JSON.stringify(p.signalement.findMany.mock.calls[0][0].select))
      .not.toMatch(/email/);
  });

  it("relit le contexte plutôt que de le rendre en texte", async () => {
    p.signalement.findMany.mockResolvedValue([{
      id: "s1", createdAt: new Date(), message: "…", page: "/",
      contexte: '{"version":"0.9.4","bureau":true}', statut: "ouvert", user: null,
    }]);
    const l = (await corps(await GET())) as unknown as { contexte: Record<string, unknown> }[];
    expect(l[0].contexte).toEqual({ version: "0.9.4", bureau: true });
  });

  it("survit à un contexte vide ou illisible", async () => {
    p.signalement.findMany.mockResolvedValue([{
      id: "s1", createdAt: new Date(), message: "…", page: "/",
      contexte: "", statut: "ouvert", user: null,
    }]);
    expect((await GET()).status).toBe(200);
  });

  it("met les signalements ouverts avant les traités", async () => {
    await GET();
    expect(p.signalement.findMany.mock.calls[0][0].orderBy[0]).toEqual({ statut: "asc" });
  });
});

describe("changement de statut", () => {
  it("accepte les deux statuts prévus", async () => {
    for (const statut of ["ouvert", "traite"]) {
      expect((await patcher({ id: "s1", statut })).status).toBe(200);
    }
  });

  it("refuse un statut inventé, un identifiant absent, un corps illisible", async () => {
    expect((await patcher({ id: "s1", statut: "supprime" })).status).toBe(400);
    expect((await patcher({ statut: "traite" })).status).toBe(400);
    expect((await patcher({ id: "", statut: "traite" })).status).toBe(400);
    expect((await PATCH(requeteCassee("/api/admin/signalements", "PATCH"))).status).toBe(400);
    expect(p.signalement.update).not.toHaveBeenCalled();
  });
});
