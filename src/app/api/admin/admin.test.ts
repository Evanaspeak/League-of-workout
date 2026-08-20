import { requete, corps, utilisateur, admin, EMAIL_ADMIN } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    systemConfig: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    invite: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    whitelist: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    levelConfig: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { GET as listerUtilisateurs } from "./users/route";
import { DELETE as supprimerUtilisateur } from "./users/[id]/route";
import { POST as reinitialiserMotDePasse } from "./users/[id]/reset-password/route";
import { GET as lireChampions, PUT as ecrireChampions, DELETE as effacerChampions } from "./config/champions/route";

const session = getCurrentUser as jest.Mock;
const user = prisma.user as unknown as Record<string, jest.Mock>;
const config = prisma.systemConfig as unknown as Record<string, jest.Mock>;

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  user.findMany.mockResolvedValue([]);
  user.findUnique.mockResolvedValue({ id: "u9", passwordHash: "$2a$dejaHache" });
  user.update.mockResolvedValue({});
  user.delete.mockResolvedValue({});
  config.findUnique.mockResolvedValue(null);
  config.upsert.mockResolvedValue({});
  config.deleteMany.mockResolvedValue({ count: 1 });
  (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([]);
});

/**
 * Tout ce qui vit sous /api/admin partage une seule règle : l'adresse du
 * demandeur doit figurer dans ADMIN_EMAILS. Le contrôle est réécrit dans
 * chaque route plutôt que centralisé ; ces tests existent pour qu'une route
 * ajoutée plus tard sans ce contrôle ne passe pas inaperçue.
 */
describe("porte d'entrée de l'administration", () => {
  /** Chaque entrée : un nom, et l'appel de la route avec ses arguments. */
  const routes: [string, () => Promise<Response>][] = [
    ["GET /users", () => listerUtilisateurs()],
    ["DELETE /users/[id]", () => supprimerUtilisateur(requete("/x", { method: "DELETE" }), params("u9"))],
    ["POST /users/[id]/reset-password", () => reinitialiserMotDePasse(requete("/x", { method: "POST" }), params("u9"))],
    ["GET /config/champions", () => lireChampions()],
    ["PUT /config/champions", () => ecrireChampions(requete("/x", { method: "PUT", body: { champions: ["Ahri"] } }))],
    ["DELETE /config/champions", () => effacerChampions()],
  ];

  it.each(routes)("%s refuse un visiteur sans session", async (_nom, appel) => {
    session.mockResolvedValue(null);
    expect((await appel()).status).toBe(403);
  });

  it.each(routes)("%s refuse un compte connecté ordinaire", async (_nom, appel) => {
    session.mockResolvedValue(utilisateur());
    expect((await appel()).status).toBe(403);
  });

  it.each(routes)("%s n'écrit rien quand elle refuse", async (_nom, appel) => {
    session.mockResolvedValue(utilisateur());
    await appel();
    for (const ecriture of [user.update, user.delete, config.upsert, config.deleteMany]) {
      expect(ecriture).not.toHaveBeenCalled();
    }
  });

  it("ne se laisse pas approcher par une adresse voisine", async () => {
    // La comparaison porte sur l'adresse entière, pas sur un préfixe.
    for (const email of [`x${EMAIL_ADMIN}`, `${EMAIL_ADMIN}.fr`, "EVANTOCQUET@GMAIL.COM.attaquant.net"]) {
      session.mockResolvedValue(utilisateur({ email }));
      expect((await listerUtilisateurs()).status).toBe(403);
    }
  });

  it("reconnaît l'administrateur quelle que soit la casse", async () => {
    session.mockResolvedValue(admin({ email: EMAIL_ADMIN.toUpperCase() }));
    expect((await listerUtilisateurs()).status).toBe(200);
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => session.mockResolvedValue(admin()));

  it("supprime un autre compte", async () => {
    const r = await supprimerUtilisateur(requete("/x", { method: "DELETE" }), params("u9"));
    expect(r.status).toBe(200);
    expect(user.delete).toHaveBeenCalledWith({ where: { id: "u9" } });
  });

  it("refuse de supprimer son propre compte", async () => {
    // Se supprimer soi-même laisserait l'application sans administrateur, sans
    // aucun moyen d'en désigner un autre depuis l'interface.
    const r = await supprimerUtilisateur(requete("/x", { method: "DELETE" }), params("admin1"));
    expect(r.status).toBe(400);
    expect(user.delete).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/users/[id]/reset-password", () => {
  beforeEach(() => session.mockResolvedValue(admin()));

  it("rend un mot de passe et n'écrit qu'une empreinte", async () => {
    const r = await reinitialiserMotDePasse(requete("/x", { method: "POST" }), params("u9"));
    const d = await corps(r) as { password: string };
    expect(d.password).toHaveLength(12);
    const ecrit = user.update.mock.calls[0][0].data;
    expect(ecrit.passwordHash).not.toBe(d.password);
    expect(ecrit.passwordHash.startsWith("$2")).toBe(true);
  });

  it("périme les sessions en cours", async () => {
    // Réinitialiser sans périmer les jetons ne reprend pas le compte en main :
    // un intrus déjà connecté le resterait trente jours.
    await reinitialiserMotDePasse(requete("/x", { method: "POST" }), params("u9"));
    expect(user.update.mock.calls[0][0].data.sessionEpoch).toEqual({ increment: 1 });
  });

  it("ne tire jamais deux fois le même mot de passe", async () => {
    // Le tirage passe par `randomBytes`, pas par `Math.random` : deux
    // réinitialisations successives ne doivent pas donner le même secret.
    // Peu d'itérations, parce que chacune paie un vrai hachage bcrypt.
    const tirages = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const d = await corps(await reinitialiserMotDePasse(requete("/x", { method: "POST" }), params("u9")));
      tirages.add(String(d.password));
    }
    expect(tirages.size).toBe(10);
  }, 30_000);

  it("répond 404 pour un compte inconnu", async () => {
    user.findUnique.mockResolvedValue(null);
    const r = await reinitialiserMotDePasse(requete("/x", { method: "POST" }), params("fantome"));
    expect(r.status).toBe(404);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("refuse sur un compte sans mot de passe", async () => {
    user.findUnique.mockResolvedValue({ id: "u9", passwordHash: null });
    const r = await reinitialiserMotDePasse(requete("/x", { method: "POST" }), params("u9"));
    expect(r.status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
  });
});

describe("liste de champions", () => {
  beforeEach(() => session.mockResolvedValue(admin()));

  it("sert la liste livrée quand rien n'est configuré", async () => {
    const d = await corps(await lireChampions()) as { champions: string[]; isDefault: boolean };
    expect(d.isDefault).toBe(true);
    expect(d.champions.length).toBeGreaterThan(100);
  });

  it("sert la liste enregistrée", async () => {
    config.findUnique.mockResolvedValue({ key: "champions", value: JSON.stringify(["Ahri", "Zed"]) });
    const d = await corps(await lireChampions());
    expect(d.champions).toEqual(["Ahri", "Zed"]);
    expect(d.isDefault).toBe(false);
  });

  it("nettoie les entrées vides à l'enregistrement", async () => {
    await ecrireChampions(requete("/x", { method: "PUT", body: { champions: ["  Ahri ", "", "   ", "Zed"] } }));
    expect(JSON.parse(config.upsert.mock.calls[0][0].update.value)).toEqual(["Ahri", "Zed"]);
  });

  it("refuse autre chose qu'une liste", async () => {
    const r = await ecrireChampions(requete("/x", { method: "PUT", body: { champions: "Ahri" } }));
    expect(r.status).toBe(400);
    expect(config.upsert).not.toHaveBeenCalled();
  });
});
