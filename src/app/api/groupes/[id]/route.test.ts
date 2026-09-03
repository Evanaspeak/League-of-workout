import { corps, requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupe: { update: jest.fn(), delete: jest.fn() },
    membreGroupe: {
      findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), deleteMany: jest.fn(),
    },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { LONGUEUR_CODE } from "@/lib/social";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  groupe: { update: jest.Mock; delete: jest.Mock };
  membreGroupe: {
    findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock; deleteMany: jest.Mock;
  };
};

const params = Promise.resolve({ id: "g1" });
const req = () => requete("/api/groupes/g1", { method: "PATCH" });
const m = (userId: string, jours: number, role = "membre") =>
  ({ id: `m-${userId}`, userId, role, createdAt: new Date(2026, 0, jours) });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.membreGroupe.findFirst.mockResolvedValue({ id: "m-moi" });
  db.membreGroupe.findMany.mockResolvedValue([m("moi", 1, "proprietaire"), m("toi", 2)]);
  db.membreGroupe.update.mockResolvedValue({});
  db.membreGroupe.deleteMany.mockResolvedValue({ count: 1 });
  db.groupe.update.mockResolvedValue({});
  db.groupe.delete.mockResolvedValue({});
});

describe("accès", () => {
  it("refuse les deux verbes sans session", async () => {
    session.mockResolvedValue(null);
    expect((await PATCH(req(), { params })).status).toBe(401);
    expect((await DELETE(req(), { params })).status).toBe(401);
    expect(db.groupe.update).not.toHaveBeenCalled();
    expect(db.membreGroupe.deleteMany).not.toHaveBeenCalled();
  });
});

describe("refaire le code", () => {
  it("n'est permis qu'au propriétaire, et seulement sur son groupe", async () => {
    await PATCH(req(), { params });
    expect(db.membreGroupe.findFirst.mock.calls[0][0].where)
      .toEqual({ groupeId: "g1", userId: "moi", role: "proprietaire" });
  });

  it("répond 404 à qui n'est pas propriétaire", async () => {
    // Le même code qu'un groupe inexistant : un simple membre n'a pas à
    // apprendre par la réponse que le groupe existe et qu'il n'a pas le droit.
    db.membreGroupe.findFirst.mockResolvedValue(null);
    expect((await PATCH(req(), { params })).status).toBe(404);
    expect(db.groupe.update).not.toHaveBeenCalled();
  });

  it("écrit un code neuf, de la bonne forme", async () => {
    const r = await corps(await PATCH(req(), { params })) as { code: string };
    expect(r.code).toHaveLength(LONGUEUR_CODE);
    expect(db.groupe.update.mock.calls[0][0]).toEqual({
      where: { id: "g1" }, data: { code: r.code },
    });
  });
});

describe("quitter", () => {
  it("refuse un groupe dont on n'est pas membre", async () => {
    db.membreGroupe.findMany.mockResolvedValue([m("toi", 2, "proprietaire")]);
    expect((await DELETE(req(), { params })).status).toBe(404);
    expect(db.membreGroupe.deleteMany).not.toHaveBeenCalled();
  });

  /**
   * La reprise AVANT le départ.
   *
   * Un groupe sans propriétaire ne peut plus refaire son code : c'est une
   * porte qu'on ne peut plus fermer, et rien ne la répare. Le pilote de
   * production ne connaissant pas les transactions, l'ordre est la seule
   * protection — une panne entre les deux laisse deux propriétaires, ce qui
   * est sans conséquence.
   */
  it("passe la propriété au plus ancien restant, avant de partir", async () => {
    await DELETE(req(), { params });
    expect(db.membreGroupe.update.mock.calls[0][0]).toEqual({
      where: { id: "m-toi" }, data: { role: "proprietaire" },
    });
    expect(db.membreGroupe.update.mock.invocationCallOrder[0])
      .toBeLessThan(db.membreGroupe.deleteMany.mock.invocationCallOrder[0]);
  });

  it("ne passe la propriété que si on l'avait", async () => {
    db.membreGroupe.findMany.mockResolvedValue([m("toi", 1, "proprietaire"), m("moi", 2)]);
    await DELETE(req(), { params });
    expect(db.membreGroupe.update).not.toHaveBeenCalled();
  });

  it("retire sa propre appartenance, filtre à l'appui", async () => {
    await DELETE(req(), { params });
    expect(db.membreGroupe.deleteMany.mock.calls[0][0].where)
      .toEqual({ id: "m-moi", userId: "moi" });
  });

  it("ne supprime pas le groupe tant qu'il reste quelqu'un", async () => {
    const r = await corps(await DELETE(req(), { params }));
    expect(r.supprime).toBe(false);
    expect(db.groupe.delete).not.toHaveBeenCalled();
  });

  it("supprime le groupe avec son dernier membre", async () => {
    // Un groupe vide n'est rejoignable par personne — le code ne circule plus
    // — et resterait là pour toujours.
    db.membreGroupe.findMany.mockResolvedValue([m("moi", 1, "proprietaire")]);
    const r = await corps(await DELETE(req(), { params }));
    expect(r.supprime).toBe(true);
    expect(db.groupe.delete.mock.calls[0][0]).toEqual({ where: { id: "g1" } });
    expect(db.membreGroupe.update).not.toHaveBeenCalled();
  });
});
