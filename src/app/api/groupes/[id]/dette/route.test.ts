import { corps, requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    membreGroupe: { findFirst: jest.fn() },
    user: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    paiement: { create: jest.fn(), findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  membreGroupe: { findFirst: jest.Mock };
  user: { findMany: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
  paiement: { create: jest.Mock; findUnique: jest.Mock };
};

const params = Promise.resolve({ id: "g1" });
const lire = () => requete("/api/groupes/g1/dette");
const payer = (body: unknown) =>
  requete("/api/groupes/g1/dette", { method: "POST", body });

const membre = (id: string, pseudo: string, dus: number, fantome = false) =>
  ({ id, pseudo, dettePointsDus: dus, fantome });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.membreGroupe.findFirst.mockResolvedValue({ id: "m-moi" });
  db.user.findMany.mockResolvedValue([membre("moi", "Moi", 10), membre("toi", "Toi", 40)]);
  db.user.update.mockResolvedValue({ dettePointsDus: 20 });
  db.paiement.create.mockResolvedValue({});
  db.paiement.findUnique.mockResolvedValue(null);
});

describe("accès", () => {
  it("refuse les deux verbes sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET(lire(), { params })).status).toBe(401);
    expect((await POST(payer({ membre: "toi", points: 5 }), { params })).status).toBe(401);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.paiement.create).not.toHaveBeenCalled();
  });

  it("un groupe dont on n'est pas membre rend 404, et ne lit RIEN", async () => {
    // 404 et non 403 : la différence des deux réponses dirait quels groupes
    // existent. Et le contrôle passe AVANT la lecture des membres, sinon on
    // ferait travailler la base pour éconduire ensuite.
    db.membreGroupe.findFirst.mockResolvedValue(null);
    expect((await GET(lire(), { params })).status).toBe(404);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("la lecture des membres est filtrée sur CE groupe", async () => {
    await GET(lire(), { params });
    expect(db.user.findMany.mock.calls[0][0].where)
      .toEqual({ groupes: { some: { groupeId: "g1" } } });
  });
});

describe("ce que l'équipe doit", () => {
  it("rend le total et les lignes", async () => {
    const r = await GET(lire(), { params });
    expect(r.status).toBe(200);
    expect(await corps(r)).toMatchObject({ total: 50, masques: 0 });
  });

  it("un membre en mode fantôme ne traverse pas le réseau", async () => {
    // Le filtre est à la LECTURE : l'écarter à l'affichage le ferait quand
    // même sortir de la base et figurer dans l'onglet réseau de qui regarde.
    db.user.findMany.mockResolvedValue([
      membre("moi", "Moi", 10), membre("toi", "Toi", 40, true),
    ]);
    const rendu = JSON.stringify(await corps(await GET(lire(), { params })));
    expect(rendu).not.toContain("Toi");
    expect(rendu).not.toContain("40");
  });
});

describe("le relais", () => {
  it("écrit la trace au nom de CELUI QUI A FAIT l'effort", async () => {
    // C'est lui qui a fait les pompes : le classement les lui compte, et
    // `pourUserId` dit seulement de quelle dette elles sont retirées.
    await POST(payer({ membre: "toi", points: 15, jour: "2026-09-04" }), { params });
    expect(db.paiement.create.mock.calls[0][0].data)
      .toMatchObject({ userId: "moi", pourUserId: "toi", points: 15, jour: "2026-09-04" });
  });

  it("décompte sur la dette du BÉNÉFICIAIRE", async () => {
    await POST(payer({ membre: "toi", points: 15 }), { params });
    expect(db.user.update.mock.calls[0][0].where).toEqual({ id: "toi" });
    expect(db.user.update.mock.calls[0][0].data).toEqual({ dettePointsDus: { decrement: 15 } });
  });

  it("la TRACE passe avant le décompte", async () => {
    // Sans transaction — le pilote de production les refuse — l'ordre est la
    // seule protection. Décompter puis échouer à tracer effacerait une dette
    // sans trace, sur le compte de quelqu'un d'autre.
    await POST(payer({ membre: "toi", points: 15 }), { params });
    expect(db.paiement.create.mock.invocationCallOrder[0])
      .toBeLessThan(db.user.update.mock.invocationCallOrder[0]);
  });

  it("ne donne jamais plus que ce que l'autre doit", async () => {
    await POST(payer({ membre: "toi", points: 999 }), { params });
    expect(db.paiement.create.mock.calls[0][0].data.points).toBe(40);
  });

  it("refuse un membre qui n'est pas de l'équipe, sans rien écrire", async () => {
    const r = await POST(payer({ membre: "inconnu", points: 5 }), { params });
    expect(r.status).toBe(404);
    expect(db.paiement.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuse de se relayer soi-même, sans rien écrire", async () => {
    const r = await POST(payer({ membre: "moi", points: 5 }), { params });
    expect(r.status).toBe(400);
    expect(db.paiement.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("un jeton déjà vu ne décompte pas une seconde fois", async () => {
    // La file hors ligne réessaie tant qu'elle n'a pas de réponse, et une
    // réponse perdue est indiscernable d'une requête jamais arrivée. Sans ce
    // court-circuit, la dette d'un TIERS baisserait deux fois.
    db.paiement.findUnique.mockResolvedValue({ userId: "moi" });
    const r = await POST(payer({ membre: "toi", points: 15, jeton: "j1" }), { params });
    expect(r.status).toBe(200);
    expect(db.paiement.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("le jeton d'un AUTRE compte ne dit rien du nôtre", async () => {
    db.paiement.findUnique.mockResolvedValue({ userId: "quelquun" });
    await POST(payer({ membre: "toi", points: 15, jeton: "j1" }), { params });
    expect(db.paiement.create).toHaveBeenCalled();
  });

  it("deux renvois croisés : le perdant ne décompte pas", async () => {
    db.paiement.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const r = await POST(payer({ membre: "toi", points: 15, jeton: "j1" }), { params });
    expect(r.status).toBe(200);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("un jour invalide retombe sur le jour local, il ne s'écrit pas tel quel", async () => {
    // « 2026-02-30 » passe un contrôle de FORME et se grave en base sur un
    // jour qu'aucun calendrier ne contient : l'effort ne compterait jamais
    // dans la série.
    await POST(payer({ membre: "toi", points: 5, jour: "2026-02-30" }), { params });
    const jour = db.paiement.create.mock.calls[0][0].data.jour;
    const aujourdhui = new Date();
    const attendu = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, "0")}-${String(aujourdhui.getDate()).padStart(2, "0")}`;
    expect(jour).toBe(attendu);
  });
});
