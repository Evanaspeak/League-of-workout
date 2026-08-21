import { requete, corps, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { systemConfig: { findUnique: jest.fn(), upsert: jest.fn() } },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, POST, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const config = prisma.systemConfig as unknown as Record<string, jest.Mock>;

const ajouter = (body: unknown) => POST(requete("/api/admin/whitelist", { method: "POST", body }));
const retirer = (body: unknown) => DELETE(requete("/api/admin/whitelist", { method: "DELETE", body }));
const listeEcrite = () => JSON.parse(config.upsert.mock.calls[0][0].update.value);

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(admin());
  config.findUnique.mockResolvedValue({ value: JSON.stringify(["deja@example.com"]) });
  config.upsert.mockResolvedValue({});
});

/**
 * La liste blanche décide qui peut créer un compte par mot de passe. Une
 * écriture ouverte à un compte ordinaire reviendrait à donner l'entrée.
 */
describe("/api/admin/whitelist", () => {
  it("refuse chaque verbe sans session", async () => {
    session.mockResolvedValue(null);
    for (const appel of [GET(), ajouter({ email: "x@y.fr" }), retirer({ email: "x@y.fr" })]) {
      expect((await appel).status).toBe(403);
    }
    expect(config.upsert).not.toHaveBeenCalled();
  });

  it("refuse chaque verbe à un compte connecté ordinaire", async () => {
    session.mockResolvedValue(utilisateur());
    for (const appel of [GET(), ajouter({ email: "x@y.fr" }), retirer({ email: "x@y.fr" })]) {
      expect((await appel).status).toBe(403);
    }
    expect(config.upsert).not.toHaveBeenCalled();
  });

  it("rend la liste enregistrée", async () => {
    expect((await corps(await GET())).emails).toEqual(["deja@example.com"]);
  });

  it("rend une liste vide quand rien n'est configuré", async () => {
    config.findUnique.mockResolvedValue(null);
    expect((await corps(await GET())).emails).toEqual([]);
  });

  it("ramène l'adresse ajoutée à sa forme canonique", async () => {
    await ajouter({ email: "  Nouveau@Example.COM  " });
    expect(listeEcrite()).toEqual(["deja@example.com", "nouveau@example.com"]);
  });

  it("n'ajoute pas deux fois la même adresse", async () => {
    await ajouter({ email: "DEJA@example.com" });
    expect(config.upsert).not.toHaveBeenCalled();
  });

  it("refuse une adresse invalide", async () => {
    for (const email of ["", "   ", null, "sansarobase"]) {
      expect((await ajouter({ email })).status).toBe(400);
    }
    expect(config.upsert).not.toHaveBeenCalled();
  });

  it("retire l'adresse demandée, quelle que soit sa casse", async () => {
    await retirer({ email: "DEJA@Example.com" });
    expect(listeEcrite()).toEqual([]);
  });

  it("reste sans effet quand l'adresse n'y était pas", async () => {
    await retirer({ email: "inconnu@example.com" });
    expect(listeEcrite()).toEqual(["deja@example.com"]);
  });
});
