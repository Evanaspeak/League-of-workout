import { requete, requeteCassee, corps, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    systemConfig: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, PUT, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { CHAMPIONS } from "@/lib/champions";

const session = getCurrentUser as jest.Mock;
const config = prisma.systemConfig as unknown as {
  findUnique: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  config.findUnique.mockResolvedValue(null);
  config.upsert.mockResolvedValue({});
  config.deleteMany.mockResolvedValue({ count: 1 });
});

const put = (body: unknown) =>
  PUT(requete("/api/admin/config/champions", { method: "PUT", body }));

/**
 * Cette liste ne décore rien : elle VALIDE. Un nom qui n'y figure pas fait
 * refuser la saisie d'une partie, bouton d'enregistrement éteint compris. Une
 * erreur ici ne se voit donc pas sur cet écran-ci — elle se voit chez quelqu'un
 * qui n'arrive plus à enregistrer son champion, et qui croira s'être trompé.
 */
describe("route admin de la liste des champions", () => {
  describe("autorisation", () => {
    it("refuse sans session", async () => {
      session.mockResolvedValue(null);
      expect((await GET()).status).toBe(403);
      expect((await put({ champions: ["Ahri"] })).status).toBe(403);
      expect((await DELETE()).status).toBe(403);
    });

    it("refuse à un compte connecté qui n'est pas administrateur", async () => {
      session.mockResolvedValue(utilisateur());
      expect((await GET()).status).toBe(403);
      expect((await put({ champions: ["Ahri"] })).status).toBe(403);
      expect((await DELETE()).status).toBe(403);
    });

    it("n'écrit rien quand elle refuse", async () => {
      // Un refus qui écrit quand même serait pire qu'une porte ouverte : on
      // croirait la liste protégée pendant qu'elle change.
      session.mockResolvedValue(utilisateur());
      await put({ champions: ["Ahri"] });
      await DELETE();
      expect(config.upsert).not.toHaveBeenCalled();
      expect(config.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("lecture", () => {
    beforeEach(() => session.mockResolvedValue(admin()));

    it("rend la liste du code quand rien n'est configuré", async () => {
      const d = await corps(await GET());
      expect(d.champions).toEqual(CHAMPIONS);
      expect(d.isDefault).toBe(true);
    });

    it("rend la liste enregistrée", async () => {
      config.findUnique.mockResolvedValue({ key: "champions", value: JSON.stringify(["Ahri", "Zed"]) });
      const d = await corps(await GET());
      expect(d.champions).toEqual(["Ahri", "Zed"]);
      expect(d.isDefault).toBe(false);
    });

    it("retombe sur la liste du code si la ligne est illisible", async () => {
      // Le panneau reste utilisable, et c'est bien ce que le produit sert :
      // les deux lecteurs de la liste retombent eux aussi sur le code.
      config.findUnique.mockResolvedValue({ key: "champions", value: "{pas du JSON" });
      const d = await corps(await GET());
      expect(d.champions).toEqual(CHAMPIONS);
      expect(d.isDefault).toBe(true);
    });

    it("survit à une base injoignable", async () => {
      config.findUnique.mockRejectedValue(new Error("base injoignable"));
      const r = await GET();
      expect(r.status).toBe(200);
      expect((await corps(r)).champions).toEqual(CHAMPIONS);
    });
  });

  describe("écriture", () => {
    beforeEach(() => session.mockResolvedValue(admin()));

    it("enregistre une liste et rend son compte", async () => {
      const d = await corps(await put({ champions: ["Ahri", "Zed"] }));
      expect(d).toEqual({ ok: true, count: 2 });
      expect(JSON.parse(config.upsert.mock.calls[0][0].update.value)).toEqual(["Ahri", "Zed"]);
    });

    it("retire les blancs autour des noms et les lignes vides", async () => {
      // Le panneau est un champ de texte d'une ligne par champion : une ligne
      // vide au bout et une espace en trop sont le cas courant, pas le cas
      // limite.
      await put({ champions: ["  Ahri  ", "", "   ", "Zed"] });
      expect(JSON.parse(config.upsert.mock.calls[0][0].update.value)).toEqual(["Ahri", "Zed"]);
    });

    /**
     * Une liste vide se refuse, ET rien ne doit être écrit.
     *
     * Elle était acceptée et rangée en base sans le moindre effet : les deux
     * lecteurs retombent sur la liste du code dès qu'elle est vide. Le panneau
     * annonçait un enregistrement réussi, montrait un champ vide au
     * rechargement, et le produit continuait de proposer les cent
     * soixante-treize.
     *
     * Les deux moitiés du contrôle comptent : un refus qui écrirait quand même
     * laisserait exactement l'état d'avant, avec un message en plus.
     */
    it("refuse une liste vide, et n'écrit rien", async () => {
      for (const vide of [[], [""], ["  ", "\t"]]) {
        const r = await put({ champions: vide });
        expect(r.status).toBe(400);
        expect(String((await corps(r)).error)).toMatch(/vide/i);
      }
      expect(config.upsert).not.toHaveBeenCalled();
    });

    it("refuse ce qui n'est pas une liste", async () => {
      expect((await put({})).status).toBe(400);
      expect((await put({ champions: "Ahri" })).status).toBe(400);
      expect(config.upsert).not.toHaveBeenCalled();
    });

    it("refuse un corps illisible", async () => {
      const r = await PUT(requeteCassee("/api/admin/config/champions", "PUT"));
      expect(r.status).toBe(400);
    });

    it("signale une table absente sans faire tomber la route", async () => {
      config.upsert.mockRejectedValue(new Error("relation SystemConfig does not exist"));
      const r = await put({ champions: ["Ahri"] });
      expect(r.status).toBe(500);
      expect(String((await corps(r)).error)).toMatch(/SystemConfig/);
    });
  });

  describe("remise à la liste livrée", () => {
    beforeEach(() => session.mockResolvedValue(admin()));

    it("supprime la ligne", async () => {
      expect((await DELETE()).status).toBe(200);
      expect(config.deleteMany).toHaveBeenCalledWith({ where: { key: "champions" } });
    });

    it("reste satisfaite quand il n'y avait rien à supprimer", async () => {
      // C'est le geste que la route recommande quand on veut vider la liste :
      // il ne doit jamais échouer parce qu'elle était déjà par défaut.
      config.deleteMany.mockRejectedValue(new Error("table absente"));
      expect((await DELETE()).status).toBe(200);
    });
  });
});
