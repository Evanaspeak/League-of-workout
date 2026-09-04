import { corps, requete, requeteCassee, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: jest.fn() },
    amitie: {
      findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn(), count: jest.fn(),
    },
    membreGroupe: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { MAX_AMIS, MAX_DEMANDES_EN_ATTENTE } from "@/lib/social";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  user: { findMany: jest.Mock };
  amitie: { findMany: jest.Mock; create: jest.Mock; updateMany: jest.Mock; count: jest.Mock };
  membreGroupe: { findMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.user.findMany.mockResolvedValue([{ id: "toi", pseudo: "Toi" }]);
  db.amitie.findMany.mockResolvedValue([]);
  db.amitie.create.mockResolvedValue({});
  db.amitie.updateMany.mockResolvedValue({ count: 1 });
  db.amitie.count.mockResolvedValue(0);
  db.membreGroupe.findMany.mockResolvedValue([]);
});

const demander = (pseudo: unknown) =>
  POST(requete("/api/amis", { method: "POST", body: { pseudo } }));

describe("accès", () => {
  it("refuse les deux verbes sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await demander("Toi")).status).toBe(401);
    expect(db.amitie.create).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});

describe("la liste", () => {
  const lien = (id: string, d: string, r: string, etat: string) => ({
    id, etat, demandeurId: d, receveurId: r, createdAt: new Date(),
    demandeur: { id: d, pseudo: d === "moi" ? "Moi" : "Autre" },
    receveur: { id: r, pseudo: r === "moi" ? "Moi" : "Autre" },
  });

  it("ne lit que les liens du compte, dans les deux sens", async () => {
    await GET();
    expect(db.amitie.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ demandeurId: "moi" }, { receveurId: "moi" }],
    });
    expect(db.membreGroupe.findMany.mock.calls[0][0].where).toEqual({ userId: "moi" });
  });

  it("range chaque lien du bon côté", async () => {
    db.amitie.findMany.mockResolvedValue([
      lien("a", "moi", "x", "acceptee"),
      lien("b", "y", "moi", "attente"),
      lien("c", "moi", "z", "attente"),
    ]);
    const r = await corps(await GET()) as Record<string, { lien: string }[]>;
    expect(r.amis.map((p) => p.lien)).toEqual(["a"]);
    expect(r.recues.map((p) => p.lien)).toEqual(["b"]);
    expect(r.envoyees.map((p) => p.lien)).toEqual(["c"]);
  });

  it("montre l'AUTRE, jamais soi-même", async () => {
    // Sans ce choix, la liste d'amis afficherait son propre pseudo autant de
    // fois qu'on a d'amis — et rien ne le signalerait sur un compte de test
    // qui n'a qu'un ami.
    db.amitie.findMany.mockResolvedValue([lien("a", "moi", "x", "acceptee")]);
    const r = await corps(await GET()) as { amis: { id: string }[] };
    expect(r.amis[0].id).toBe("x");
  });

  it("ne lit du compte de l'autre que de quoi le NOMMER", async () => {
    // Une amitié donne accès à un nom, pas à un compte. C'est le `select` qui
    // l'empêche : `include` publierait l'adresse électronique et le jeton de
    // diffusion de quelqu'un d'autre.
    //
    // `riotId` et `nomAffiche` en font partie depuis la réponse 128 : sans eux,
    // impossible d'appliquer le choix de celui qu'on nomme. Ils sont LUS, et
    // c'est le contrôle suivant qui garantit qu'ils ne sortent pas.
    await GET();
    const select = db.amitie.findMany.mock.calls[0][0].select;
    const attendu = { select: { id: true, pseudo: true, riotId: true, nomAffiche: true } };
    expect(select.demandeur).toEqual(attendu);
    expect(select.receveur).toEqual(attendu);
  });

  it("et n'en PUBLIE que l'identifiant et le nom choisi", async () => {
    /**
     * Le contrôle qui compte depuis la réponse 128.
     *
     * La réponse était construite par `{ lien: l.id, ...autre(l) }` — un
     * étalement, donc tout ce que le `select` ramène. Élargir le `select` pour
     * appliquer le choix aurait donc publié le pseudo Riot de tout le monde, y
     * compris de ceux qui viennent de demander l'inverse. C'est le défaut déjà
     * corrigé sur le compte par `comptePublic`, un modèle plus bas.
     */
    db.amitie.findMany.mockResolvedValue([
      {
        id: "l1", etat: "acceptee", demandeurId: "moi", receveurId: "x",
        demandeur: { id: "moi", pseudo: "Moi", riotId: "MoiLoL#EUW", nomAffiche: "pseudo" },
        receveur: { id: "x", pseudo: "Ana", riotId: "AnaLoL#EUW", nomAffiche: "pseudo" },
      },
    ]);
    const rendu = JSON.stringify(await corps(await GET()));
    expect(rendu).toContain("Ana");
    expect(rendu).not.toContain("AnaLoL");
    expect(rendu).not.toContain("nomAffiche");
  });

  it("et publie le pseudo Riot de qui l'a choisi, sans son discriminant", async () => {
    db.amitie.findMany.mockResolvedValue([
      {
        id: "l1", etat: "acceptee", demandeurId: "moi", receveurId: "x",
        demandeur: { id: "moi", pseudo: "Moi", riotId: null, nomAffiche: "pseudo" },
        receveur: { id: "x", pseudo: "Ana", riotId: "AnaLoL#EUW", nomAffiche: "riot" },
      },
    ]);
    const r = await corps(await GET()) as { amis: { pseudo: string }[] };
    expect(r.amis[0].pseudo).toBe("AnaLoL");
  });

  it("dit qui est propriétaire de chaque groupe", async () => {
    db.membreGroupe.findMany.mockResolvedValue([
      { role: "proprietaire", groupe: { id: "g1", nom: "A", code: "ABCDEFGH", _count: { membres: 3 } } },
      { role: "membre", groupe: { id: "g2", nom: "B", code: "HGFEDCBA", _count: { membres: 1 } } },
    ]);
    const r = await corps(await GET()) as { groupes: { id: string; proprietaire: boolean; membres: number }[] };
    expect(r.groupes).toEqual([
      { id: "g1", nom: "A", code: "ABCDEFGH", membres: 3, proprietaire: true },
      { id: "g2", nom: "B", code: "HGFEDCBA", membres: 1, proprietaire: false },
    ]);
  });
});

describe("demander une amitié", () => {
  it("refuse un corps illisible", async () => {
    expect((await POST(requeteCassee("/api/amis"))).status).toBe(400);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("refuse un pseudo qui n'en est pas un", async () => {
    expect((await demander(undefined)).status).toBe(400);
    expect((await demander("<b>x</b>")).status).toBe(400);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("cherche le pseudo EXACT, sans tenir compte de la casse", async () => {
    await demander("toi");
    expect(db.user.findMany.mock.calls[0][0].where)
      .toEqual({ pseudo: { equals: "toi", mode: "insensitive" } });
  });

  it("répond 404 quand personne ne porte ce pseudo", async () => {
    db.user.findMany.mockResolvedValue([]);
    expect((await demander("Fantome")).status).toBe(404);
    expect(db.amitie.create).not.toHaveBeenCalled();
  });

  /**
   * L'unicité des pseudos vit dans l'application, pas en base, et des doublons
   * existent déjà. Prendre le premier enverrait la demande à la mauvaise
   * personne — le seul résultat qu'on ne peut pas rattraper, puisqu'elle n'a
   * aucun moyen de savoir qu'elle n'était pas la destinataire.
   */
  it("refuse plutôt que de choisir entre deux homonymes", async () => {
    db.user.findMany.mockResolvedValue([{ id: "a", pseudo: "Toi" }, { id: "b", pseudo: "toi" }]);
    expect((await demander("Toi")).status).toBe(409);
    expect(db.amitie.create).not.toHaveBeenCalled();
  });

  it("refuse de s'ajouter soi-même", async () => {
    db.user.findMany.mockResolvedValue([{ id: "moi", pseudo: "Moi" }]);
    expect((await demander("Moi")).status).toBe(400);
    expect(db.amitie.create).not.toHaveBeenCalled();
  });

  it("crée la demande dans le bon sens", async () => {
    await demander("Toi");
    expect(db.amitie.create.mock.calls[0][0].data)
      .toEqual({ demandeurId: "moi", receveurId: "toi" });
  });

  it("regarde les liens existants DANS LES DEUX SENS", async () => {
    // L'unicité en base porte sur un couple orienté : chercher dans un seul
    // sens laisserait passer le doublon inverse.
    await demander("Toi");
    expect(db.amitie.findMany.mock.calls[0][0].where).toEqual({
      OR: [
        { demandeurId: "moi", receveurId: "toi" },
        { demandeurId: "toi", receveurId: "moi" },
      ],
    });
  });

  it("refuse une demande déjà envoyée, et une amitié déjà faite", async () => {
    db.amitie.findMany.mockResolvedValue([
      { id: "x", demandeurId: "moi", receveurId: "toi", etat: "attente" },
    ]);
    expect((await demander("Toi")).status).toBe(409);
    db.amitie.findMany.mockResolvedValue([
      { id: "x", demandeurId: "toi", receveurId: "moi", etat: "acceptee" },
    ]);
    expect((await demander("Toi")).status).toBe(409);
    expect(db.amitie.create).not.toHaveBeenCalled();
  });

  it("accepte au lieu de créer un doublon quand l'autre avait déjà demandé", async () => {
    db.amitie.findMany.mockResolvedValue([
      { id: "x9", demandeurId: "toi", receveurId: "moi", etat: "attente" },
    ]);
    const r = await corps(await demander("Toi"));
    expect(r.etat).toBe("acceptee");
    expect(db.amitie.create).not.toHaveBeenCalled();
    expect(db.amitie.updateMany.mock.calls[0][0].where)
      .toEqual({ id: "x9", receveurId: "moi" });
  });

  it("refuse au-delà du plafond de demandes en attente", async () => {
    // C'est ce qui remplace la modération : personne ne relit ce qui se passe
    // ici, donc demander à tout le monde doit être impossible.
    db.amitie.count.mockImplementation((args: { where: { etat: string } }) =>
      Promise.resolve(args.where.etat === "attente" ? MAX_DEMANDES_EN_ATTENTE : 0));
    expect((await demander("Toi")).status).toBe(429);
    expect(db.amitie.create).not.toHaveBeenCalled();
  });

  it("refuse au-delà du plafond d'amis", async () => {
    db.amitie.count.mockImplementation((args: { where: { etat: string } }) =>
      Promise.resolve(args.where.etat === "acceptee" ? MAX_AMIS : 0));
    expect((await demander("Toi")).status).toBe(409);
    expect(db.amitie.create).not.toHaveBeenCalled();
  });

  it("ne compte les amis que sur le compte de la session", async () => {
    await demander("Toi");
    const wheres = db.amitie.count.mock.calls.map((c: [{ where: unknown }]) => c[0].where);
    expect(wheres).toContainEqual({
      etat: "acceptee", OR: [{ demandeurId: "moi" }, { receveurId: "moi" }],
    });
    expect(wheres).toContainEqual({ etat: "attente", demandeurId: "moi" });
  });
});
