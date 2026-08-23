import { requete, requeteCassee, corps, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    systemConfig: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
// L'invalidation de cache n'existe qu'en contexte Next : on vérifie qu'elle
// est demandée, pas ce qu'elle fait.
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { GET, PUT, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { RATIOS_DEFAUT, appliquerRatios } from "@/lib/exercices";

const session = getCurrentUser as jest.Mock;
const config = prisma.systemConfig as unknown as {
  findUnique: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  config.findUnique.mockResolvedValue(null);
  config.upsert.mockResolvedValue({});
  config.deleteMany.mockResolvedValue({ count: 1 });
  appliquerRatios(RATIOS_DEFAUT);
});

/**
 * Ces ratios décident de ce qu'un humain doit physiquement faire. La route qui
 * les modifie est donc autant un point d'autorisation qu'un point de calcul :
 * les deux sont éprouvés ici.
 */
describe("routes admin des ratios d'exercices", () => {
  describe("autorisation", () => {
    it("refuse sans session", async () => {
      session.mockResolvedValue(null);
      for (const appel of [
        GET(),
        PUT(requete("/api/admin/config/exercices", { method: "PUT", body: { ratios: { squats: 9 } } })),
        DELETE(),
      ]) {
        expect((await appel).status).toBe(403);
      }
    });

    it("refuse à un compte connecté qui n'est pas administrateur", async () => {
      session.mockResolvedValue(utilisateur());
      expect((await GET()).status).toBe(403);
      const r = await PUT(requete("/api/admin/config/exercices", { method: "PUT", body: { ratios: { squats: 9 } } }));
      expect(r.status).toBe(403);
      expect((await DELETE()).status).toBe(403);
    });

    it("n'écrit rien quand elle refuse", async () => {
      session.mockResolvedValue(utilisateur());
      await PUT(requete("/api/admin/config/exercices", { method: "PUT", body: { ratios: { squats: 9 } } }));
      await DELETE();
      expect(config.upsert).not.toHaveBeenCalled();
      expect(config.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("lecture", () => {
    beforeEach(() => session.mockResolvedValue(admin()));

    it("rend les valeurs d'origine quand rien n'est configuré", async () => {
      const d = await corps(await GET());
      expect(d.ratios).toEqual(RATIOS_DEFAUT);
      expect(d.parDefaut).toBe(true);
    });

    it("rend la valeur enregistrée", async () => {
      config.findUnique.mockResolvedValue({ key: "exercices", value: JSON.stringify({ squats: 4, boxe: 12 }) });
      const d = await corps(await GET());
      // `toMatchObject` et non `toEqual` : le catalogue s'agrandit, et un
      // exercice ajouté ne doit pas faire échouer un test qui ne parle pas de
      // lui. Ce qui compte ici, c'est que la valeur enregistrée ressorte.
      expect(d.ratios).toMatchObject({ pompes: 1, squats: 4, boxe: 12 });
      expect(d.parDefaut).toBe(false);
    });

    it("retombe sur les valeurs d'origine si la ligne est illisible", async () => {
      config.findUnique.mockResolvedValue({ key: "exercices", value: "{pas du JSON" });
      const d = await corps(await GET());
      expect(d.ratios).toEqual(RATIOS_DEFAUT);
    });

    it("survit à une base injoignable", async () => {
      config.findUnique.mockRejectedValue(new Error("base injoignable"));
      const r = await GET();
      expect(r.status).toBe(200);
      expect((await corps(r)).ratios).toEqual(RATIOS_DEFAUT);
    });
  });

  describe("écriture", () => {
    beforeEach(() => session.mockResolvedValue(admin()));

    const put = (body: unknown) =>
      PUT(requete("/api/admin/config/exercices", { method: "PUT", body }));

    it("enregistre des ratios valides", async () => {
      const d = await corps(await put({ ratios: { squats: 2, boxe: 9 } }));
      expect(d.ratios).toMatchObject({ pompes: 1, squats: 2, boxe: 9 });
      expect(JSON.parse(config.upsert.mock.calls[0][0].update.value))
        .toMatchObject({ pompes: 1, squats: 2, boxe: 9 });
    });

    it("ignore une tentative de déplacer les pompes", async () => {
      // Le point d'effort EST la pompe : ce ratio ne doit jamais bouger,
      // sans quoi tout l'historique se relit dans une autre unité.
      const d = await corps(await put({ ratios: { pompes: 5, squats: 2 } })) as { ratios: Record<string, number> };
      expect(d.ratios.pompes).toBe(1);
    });

    it("ramène les valeurs hors bornes dans les bornes", async () => {
      const d = await corps(await put({ ratios: { squats: 9999, boxe: -4 } })) as { ratios: Record<string, number> };
      expect(d.ratios.squats).toBe(10);
      expect(d.ratios.boxe).toBe(1);
    });

    it("refuse un corps sans ratios", async () => {
      expect((await put({})).status).toBe(400);
      expect((await put({ ratios: "beaucoup" })).status).toBe(400);
      expect(config.upsert).not.toHaveBeenCalled();
    });

    it("refuse un corps illisible", async () => {
      const r = await PUT(requeteCassee("/api/admin/config/exercices", "PUT"));
      expect(r.status).toBe(400);
    });

    it("signale une table absente sans faire tomber la route", async () => {
      config.upsert.mockRejectedValue(new Error("relation SystemConfig does not exist"));
      const r = await put({ ratios: { squats: 2 } });
      expect(r.status).toBe(500);
      expect(String((await corps(r)).error)).toMatch(/SystemConfig/);
    });

    it("demande l'invalidation du cache après un enregistrement", async () => {
      await put({ ratios: { squats: 2 } });
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });
  });

  describe("retour aux valeurs d'origine", () => {
    beforeEach(() => session.mockResolvedValue(admin()));

    it("supprime la ligne et rend les défauts", async () => {
      const d = await corps(await DELETE());
      expect(d.ratios).toEqual(RATIOS_DEFAUT);
      expect(config.deleteMany).toHaveBeenCalledWith({ where: { key: "exercices" } });
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("reste satisfaite quand il n'y avait rien à supprimer", async () => {
      config.deleteMany.mockRejectedValue(new Error("table absente"));
      expect((await DELETE()).status).toBe(200);
    });
  });
});
