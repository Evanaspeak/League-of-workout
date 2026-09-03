import { corps, requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    amitie: { updateMany: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { MAX_AMIS } from "@/lib/social";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  amitie: { updateMany: jest.Mock; deleteMany: jest.Mock; count: jest.Mock };
};

const params = Promise.resolve({ id: "a1" });
const req = () => requete("/api/amis/a1", { method: "PATCH" });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.amitie.updateMany.mockResolvedValue({ count: 1 });
  db.amitie.deleteMany.mockResolvedValue({ count: 1 });
  db.amitie.count.mockResolvedValue(0);
});

describe("accès", () => {
  it("refuse les deux verbes sans session", async () => {
    session.mockResolvedValue(null);
    expect((await PATCH(req(), { params })).status).toBe(401);
    expect((await DELETE(req(), { params })).status).toBe(401);
    expect(db.amitie.updateMany).not.toHaveBeenCalled();
    expect(db.amitie.deleteMany).not.toHaveBeenCalled();
  });
});

describe("accepter", () => {
  /**
   * Le filtre qui compte.
   *
   * Sans `receveurId`, celui qui a demandé pourrait accepter sa propre
   * demande : l'amitié ne serait plus une amitié, elle s'imposerait.
   */
  it("n'accepte que ce qu'on a REÇU, et seulement en attente", async () => {
    await PATCH(req(), { params });
    expect(db.amitie.updateMany.mock.calls[0][0].where)
      .toEqual({ id: "a1", receveurId: "moi", etat: "attente" });
  });

  it("marque l'état et la date", async () => {
    await PATCH(req(), { params });
    const data = db.amitie.updateMany.mock.calls[0][0].data;
    expect(data.etat).toBe("acceptee");
    expect(data.accepteeLe).toBeInstanceOf(Date);
  });

  it("répond 404 quand rien n'a bougé", async () => {
    // Une demande qui n'existe pas, ou qu'on n'a pas reçue : dans les deux cas
    // il n'y a rien à accepter, et le dire vaut mieux qu'un 200 muet.
    db.amitie.updateMany.mockResolvedValue({ count: 0 });
    expect((await PATCH(req(), { params })).status).toBe(404);
  });

  it("refuse au-delà du plafond d'amis", async () => {
    db.amitie.count.mockResolvedValue(MAX_AMIS);
    expect((await PATCH(req(), { params })).status).toBe(409);
    expect(db.amitie.updateMany).not.toHaveBeenCalled();
  });
});

describe("retirer", () => {
  it("efface la ligne plutôt que de marquer un refus", async () => {
    // Garder la trace d'un refus donnerait à qui insiste le moyen de savoir
    // qu'il a été refusé, et personne ne modère ce qui suivrait.
    await DELETE(req(), { params });
    expect(db.amitie.deleteMany).toHaveBeenCalled();
    expect(db.amitie.updateMany).not.toHaveBeenCalled();
  });

  it("ne touche qu'un lien dont on est l'une des deux parties", async () => {
    await DELETE(req(), { params });
    expect(db.amitie.deleteMany.mock.calls[0][0].where).toEqual({
      id: "a1", OR: [{ demandeurId: "moi" }, { receveurId: "moi" }],
    });
  });

  it("répond 404 quand rien n'a été retiré", async () => {
    db.amitie.deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(req(), { params });
    expect(res.status).toBe(404);
    expect((await corps(res)).retire).toBeUndefined();
  });
});
