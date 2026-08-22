/**
 * Le budget de la clé Riot.
 *
 * Ce qui est éprouvé ici n'est pas une politesse d'interface : c'est le seul
 * garde-fou qui empêche cent comptes parfaitement raisonnables de vider une
 * clé partagée. Une limite par compte ne le fait pas — c'est justement le
 * piège que ce fichier existe pour éviter.
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    loginAttempt: {
      count: jest.fn(), create: jest.fn(), createMany: jest.fn(),
      deleteMany: jest.fn(), findMany: jest.fn(),
    },
  },
}));

import { COUT, messageRefus, rendreAuBudget, reserverRiot } from "./riotBudget";
import { prisma } from "@/lib/prisma";

const la = (prisma as unknown as { loginAttempt: Record<string, jest.Mock> }).loginAttempt;

/**
 * Le compteur répond selon la nature demandée : c'est ainsi qu'on sépare le
 * verrou du compte de celui de la clé sans deux doublures distinctes.
 */
function compteurs({ compte = 0, cle = 0 }: { compte?: number; cle?: number }) {
  la.count.mockImplementation(({ where }: { where: { kind: string } }) =>
    Promise.resolve(where.kind === "riot-cle" ? cle : compte));
}

beforeEach(() => {
  jest.clearAllMocks();
  la.deleteMany.mockResolvedValue({});
  la.create.mockResolvedValue({});
  la.createMany.mockResolvedValue({});
  la.findMany.mockResolvedValue([]);
});

describe("réservation", () => {
  it("laisse passer un appel quand les deux budgets sont libres", async () => {
    compteurs({});
    expect(await reserverRiot("u1", COUT.dernierePartie)).toBeNull();
    // La réservation est posée AVANT les appels : deux requêtes simultanées
    // verraient sinon toutes les deux du budget libre.
    expect(la.createMany).toHaveBeenCalled();
    expect(la.createMany.mock.calls[0][0].data).toHaveLength(COUT.dernierePartie);
  });

  it("refuse au nom du compte quand c'est lui qui a trop tiré", async () => {
    compteurs({ compte: 40 });
    expect(await reserverRiot("u1", COUT.dernierePartie)).toEqual({ raison: "compte" });
    expect(la.createMany).not.toHaveBeenCalled();
  });

  it("refuse au nom de la clé même si le compte n'a rien fait", async () => {
    // Le cas qui compte : cent comptes irréprochables, une clé vide.
    compteurs({ compte: 0, cle: 89 });
    expect(await reserverRiot("u1", COUT.dernierePartie)).toEqual({ raison: "cle" });
    expect(la.createMany).not.toHaveBeenCalled();
  });

  it("refuse un historique quand il reste de quoi faire une dernière partie mais pas vingt et un", async () => {
    compteurs({ compte: 0, cle: 80 }); // dix de reste
    expect(await reserverRiot("u1", COUT.historique)).toEqual({ raison: "cle" });
    expect(await reserverRiot("u1", COUT.dernierePartie)).toBeNull();
  });

  it("compte des requêtes Riot, pas des appels de route", async () => {
    compteurs({});
    await reserverRiot("u1", COUT.historique);
    expect(la.createMany.mock.calls[0][0].data).toHaveLength(21);
  });
});

describe("restitution", () => {
  it("rend ce qui n'a pas été dépensé", async () => {
    la.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await rendreAuBudget(21, 19);
    expect(la.findMany.mock.calls[0][0].take).toBe(2);
    expect(la.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a", "b"] } } });
  });

  it("ne rend rien quand tout a été dépensé", async () => {
    await rendreAuBudget(21, 21);
    expect(la.deleteMany).not.toHaveBeenCalled();
  });

  it("ne vole pas de budget quand la dépense dépasse la réserve", async () => {
    await rendreAuBudget(2, 5);
    expect(la.deleteMany).not.toHaveBeenCalled();
  });
});

describe("message", () => {
  it("distingue les deux refus, parce qu'ils ne se corrigent pas pareil", () => {
    expect(messageRefus({ raison: "compte" })).not.toBe(messageRefus({ raison: "cle" }));
    for (const raison of ["compte", "cle"] as const) {
      // Pas de grand tiret dans un texte que l'utilisateur lit.
      expect(messageRefus({ raison })).not.toMatch(/—/);
    }
  });
});
