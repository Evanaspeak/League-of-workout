import { corps, requete, requeteCassee, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupe: { findUnique: jest.fn() },
    membreGroupe: { create: jest.fn(), count: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { MAX_GROUPES, MAX_MEMBRES } from "@/lib/social";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  groupe: { findUnique: jest.Mock };
  membreGroupe: { create: jest.Mock; count: jest.Mock };
};

const rejoindre = (code: unknown) =>
  POST(requete("/api/groupes/rejoindre", { method: "POST", body: { code } }));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.groupe.findUnique.mockResolvedValue({
    id: "g1", nom: "Les Bras", code: "ABCDEFGH", _count: { membres: 2 },
  });
  db.membreGroupe.count.mockResolvedValue(0);
  db.membreGroupe.create.mockResolvedValue({});
});

describe("accès", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await rejoindre("ABCDEFGH")).status).toBe(401);
    expect(db.groupe.findUnique).not.toHaveBeenCalled();
  });
});

describe("rejoindre par code", () => {
  it("refuse un corps illisible", async () => {
    expect((await POST(requeteCassee("/api/groupes/rejoindre"))).status).toBe(400);
    expect(db.groupe.findUnique).not.toHaveBeenCalled();
  });

  it("refuse ce qui n'est pas un code, sans toucher la base", async () => {
    expect((await rejoindre(undefined)).status).toBe(400);
    expect((await rejoindre("ABC")).status).toBe(400);
    expect((await rejoindre("ABCDEFGO")).status).toBe(400);
    expect(db.groupe.findUnique).not.toHaveBeenCalled();
  });

  it("accepte le code tel qu'on le tape, minuscules et tiret compris", async () => {
    // C'est la seule porte du groupe : la refuser pour une question de
    // présentation, c'est la fermer.
    await rejoindre("abcd-efgh");
    expect(db.groupe.findUnique.mock.calls[0][0].where).toEqual({ code: "ABCDEFGH" });
  });

  it("répond 404 sur un code inconnu", async () => {
    db.groupe.findUnique.mockResolvedValue(null);
    expect((await rejoindre("ABCDEFGH")).status).toBe(404);
    expect(db.membreGroupe.create).not.toHaveBeenCalled();
  });

  /**
   * Un groupe plein rend la MÊME réponse qu'un code inconnu.
   *
   * Les distinguer dirait, par la différence des deux réponses, quels codes
   * existent : essayer des codes au hasard deviendrait un moyen de trouver les
   * groupes, ce que le code d'invitation existe précisément pour empêcher.
   */
  it("ne distingue pas un groupe plein d'un code inconnu", async () => {
    db.groupe.findUnique.mockResolvedValue({
      id: "g1", nom: "Les Bras", code: "ABCDEFGH", _count: { membres: MAX_MEMBRES },
    });
    const plein = await rejoindre("ABCDEFGH");
    db.groupe.findUnique.mockResolvedValue(null);
    const inconnu = await rejoindre("ABCDEFGH");
    expect(plein.status).toBe(inconnu.status);
    expect((await corps(plein)).error).toBe((await corps(inconnu)).error);
    expect(db.membreGroupe.create).not.toHaveBeenCalled();
  });

  it("entre comme membre, jamais comme propriétaire", async () => {
    await rejoindre("ABCDEFGH");
    expect(db.membreGroupe.create.mock.calls[0][0].data)
      .toEqual({ groupeId: "g1", userId: "moi" });
  });

  it("y être déjà n'est pas une erreur", async () => {
    // Le code se colle deux fois, un envoi part en double : la réponse juste
    // est « tu y es », pas un refus qui laisse croire que le code ne marche pas.
    db.membreGroupe.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }));
    const res = await rejoindre("ABCDEFGH");
    expect(res.status).toBe(200);
    expect((await corps(res)).deja).toBe(true);
  });

  it("laisse passer une erreur qui n'est pas un doublon", async () => {
    db.membreGroupe.create.mockRejectedValue(new Error("la base est tombée"));
    await expect(rejoindre("ABCDEFGH")).rejects.toThrow("la base est tombée");
  });

  it("refuse au-delà du plafond de groupes du compte", async () => {
    db.membreGroupe.count.mockResolvedValue(MAX_GROUPES);
    expect((await rejoindre("ABCDEFGH")).status).toBe(409);
    expect(db.membreGroupe.count.mock.calls[0][0].where).toEqual({ userId: "moi" });
    expect(db.membreGroupe.create).not.toHaveBeenCalled();
  });
});
