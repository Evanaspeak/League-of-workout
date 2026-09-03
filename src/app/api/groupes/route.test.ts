import { corps, requete, requeteCassee, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    groupe: { create: jest.fn() },
    membreGroupe: { create: jest.fn(), count: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { LONGUEUR_CODE, MAX_GROUPES } from "@/lib/social";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  groupe: { create: jest.Mock };
  membreGroupe: { create: jest.Mock; count: jest.Mock };
};

const creer = (nom: unknown) =>
  POST(requete("/api/groupes", { method: "POST", body: { nom } }));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.membreGroupe.count.mockResolvedValue(0);
  db.membreGroupe.create.mockResolvedValue({});
  db.groupe.create.mockImplementation(({ data }: { data: { nom: string; code: string } }) =>
    Promise.resolve({ id: "g1", nom: data.nom, code: data.code }));
});

describe("accès", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await creer("Les Bras")).status).toBe(401);
    expect(db.groupe.create).not.toHaveBeenCalled();
  });
});

describe("créer un groupe", () => {
  it("refuse un corps illisible", async () => {
    expect((await POST(requeteCassee("/api/groupes"))).status).toBe(400);
    expect(db.groupe.create).not.toHaveBeenCalled();
  });

  it("refuse un nom qui n'en est pas un", async () => {
    expect((await creer(undefined)).status).toBe(400);
    expect((await creer("a")).status).toBe(400);
    expect((await creer("<b>x</b>")).status).toBe(400);
    expect(db.groupe.create).not.toHaveBeenCalled();
  });

  it("range le nom sans les espaces du bord", async () => {
    await creer("  Les Bras  ");
    expect(db.groupe.create.mock.calls[0][0].data.nom).toBe("Les Bras");
  });

  it("tire un code de la bonne forme", async () => {
    const r = await corps(await creer("Les Bras")) as { code: string };
    expect(r.code).toHaveLength(LONGUEUR_CODE);
    expect(r.code).toMatch(/^[A-Z2-9]+$/);
  });

  /**
   * L'ORDRE est la seule protection : le pilote de production ne connaît pas
   * les transactions. Le groupe d'abord — une panne entre les deux laisse un
   * groupe que personne ne voit, son code n'ayant jamais été rendu. L'inverse
   * est impossible, la clé étrangère refusant une appartenance sans groupe.
   */
  it("écrit le groupe AVANT l'appartenance", async () => {
    await creer("Les Bras");
    expect(db.groupe.create.mock.invocationCallOrder[0])
      .toBeLessThan(db.membreGroupe.create.mock.invocationCallOrder[0]);
  });

  it("fait du créateur le propriétaire", async () => {
    // Un groupe sans propriétaire ne peut plus refaire son code, c'est-à-dire
    // plus révoquer un lien déjà partagé.
    await creer("Les Bras");
    expect(db.membreGroupe.create.mock.calls[0][0].data)
      .toEqual({ groupeId: "g1", userId: "moi", role: "proprietaire" });
  });

  it("retente sur un code déjà pris", async () => {
    const pris = Object.assign(new Error("unique"), { code: "P2002" });
    db.groupe.create.mockRejectedValueOnce(pris);
    expect((await creer("Les Bras")).status).toBe(200);
    expect(db.groupe.create).toHaveBeenCalledTimes(2);
  });

  it("ne fait pas avaler par la boucle une erreur qui n'a rien à voir", async () => {
    db.groupe.create.mockRejectedValue(new Error("la base est tombée"));
    await expect(creer("Les Bras")).rejects.toThrow("la base est tombée");
    expect(db.groupe.create).toHaveBeenCalledTimes(1);
    expect(db.membreGroupe.create).not.toHaveBeenCalled();
  });

  it("renonce plutôt que de boucler quand tous les codes sont pris", async () => {
    db.groupe.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    expect((await creer("Les Bras")).status).toBe(500);
    expect(db.membreGroupe.create).not.toHaveBeenCalled();
  });

  it("refuse au-delà du plafond, et ne compte que ses propres groupes", async () => {
    db.membreGroupe.count.mockResolvedValue(MAX_GROUPES);
    expect((await creer("Les Bras")).status).toBe(409);
    expect(db.membreGroupe.count.mock.calls[0][0].where).toEqual({ userId: "moi" });
    expect(db.groupe.create).not.toHaveBeenCalled();
  });
});
