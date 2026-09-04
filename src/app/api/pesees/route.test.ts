import { requete, corps, utilisateur } from "@/test/api";
import { jourLocal } from "@/lib/serie";

jest.mock("@/lib/prisma", () => {
  const pesee = { findMany: jest.fn(), upsert: jest.fn() };
  return { prisma: { pesee } };
});
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const pesee = (prisma as unknown as
  { pesee: { findMany: jest.Mock; upsert: jest.Mock } }).pesee;

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "u1" }));
  pesee.findMany.mockResolvedValue([{ jour: "2026-09-01", grammes: 78_400 }]);
  pesee.upsert.mockResolvedValue({});
});

const poster = (body: unknown) => POST(requete("/api/pesees", { method: "POST", body }));

describe("GET /api/pesees", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("ne lit que les pesées du demandeur", async () => {
    /**
     * Le contrôle qui compte sur toute route de lecture : sans le filtre, la
     * courbe de quelqu'un d'autre s'afficherait sur cet écran.
     */
    await GET();
    expect(pesee.findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });

  it("rend les pesées dans l'ordre du temps", () => {
    // Une courbe dont les points arrivent dans le désordre se dessine en
    // zigzag : l'ordre n'est pas un confort, c'est ce qui la rend lisible.
    return GET().then(() => {
      expect(pesee.findMany.mock.calls[0][0].orderBy).toEqual({ jour: "asc" });
    });
  });
});

describe("POST /api/pesees", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await poster({ grammes: 78_400 })).status).toBe(401);
  });

  it("enregistre une pesée sur le compte du demandeur", async () => {
    const r = await poster({ grammes: 78_400, jour: "2026-09-03" });
    expect(r.status).toBe(200);
    expect(pesee.upsert.mock.calls[0][0].where)
      .toEqual({ userId_jour: { userId: "u1", jour: "2026-09-03" } });
  });

  it("remplace celle du jour plutôt que d'en ajouter une seconde", async () => {
    /**
     * Se peser deux fois dans la journée est courant, et c'est la SECONDE qui
     * compte. `create` ferait deux points sur la même abscisse ; refuser
     * obligerait à supprimer la première, un geste de plus pour rien.
     */
    await poster({ grammes: 78_400, jour: "2026-09-03" });
    const appel = pesee.upsert.mock.calls[0][0];
    expect(appel.update).toEqual({ grammes: 78_400 });
    expect(appel.create).toEqual({ userId: "u1", jour: "2026-09-03", grammes: 78_400 });
  });

  it("refuse un poids hors de tout domaine, et n'écrit rien", async () => {
    /**
     * `null` figure ici sous la forme que le RÉSEAU en fait :
     * `JSON.stringify(NaN)` rend `null`, et `Number(null)` vaut zéro. Écrit
     * autrement, ce cas n'éprouverait pas ce qui arrive vraiment.
     */
    for (const g of [0, -5, 19_000, 500_001, 1e308, null, "78", [], {}]) {
      expect((await poster({ grammes: g })).status).toBe(400);
    }
    expect(pesee.upsert).not.toHaveBeenCalled();
  });

  it("retombe sur le jour du serveur quand celui reçu n'existe pas", async () => {
    /**
     * « 2026-02-30 » a la bonne FORME et n'existe pas. Écrit tel quel, il
     * resterait en base pour toujours sur une date qu'aucun calendrier ne
     * contient, et le point ne se placerait jamais sur la courbe.
     */
    await poster({ grammes: 78_400, jour: "2026-02-30" });
    expect(pesee.upsert.mock.calls[0][0].where.userId_jour.jour).toBe(jourLocal());
  });

  it("refuse une pesée datée du futur", async () => {
    // Elle décalerait la courbe et fausserait le rappel hebdomadaire, qui
    // regarde la dernière en date.
    const r = await poster({ grammes: 78_400, jour: "2999-01-01" });
    expect(r.status).toBe(400);
    expect(pesee.upsert).not.toHaveBeenCalled();
  });

  it("rend la courbe entière, pour que l'écran n'ait pas à redemander", async () => {
    const r = await poster({ grammes: 78_400 });
    expect((await corps(r) as { pesees: unknown[] }).pesees).toHaveLength(1);
  });
});
