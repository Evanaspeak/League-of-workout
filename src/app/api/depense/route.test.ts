import { requete, corps, utilisateur } from "@/test/api";
import { jourLocal } from "@/lib/serie";

jest.mock("@/lib/prisma", () => {
  const depenseJour = { findMany: jest.fn(), upsert: jest.fn() };
  return { prisma: { depenseJour } };
});
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const table = (prisma as unknown as
  { depenseJour: { findMany: jest.Mock; upsert: jest.Mock } }).depenseJour;

/** Un profil complet : métabolisme de base à 1 780 kcal. */
const PROFIL = {
  id: "u1", formuleCalorique: "h", poids: 80, taille: 180, age: 30,
  niveauActivite: "modere",
};

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur(PROFIL));
  table.findMany.mockResolvedValue([{ jour: "2026-09-01", kcalBrulees: 2_640 }]);
  table.upsert.mockResolvedValue({});
});

const poster = (body: unknown) => POST(requete("/api/depense", { method: "POST", body }));

describe("GET /api/depense", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("ne lit que les relevés du demandeur", async () => {
    await GET();
    expect(table.findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });
});

describe("POST /api/depense", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await poster({ kcalBrulees: 2_600 })).status).toBe(401);
  });

  it("enregistre la dépense du jour", async () => {
    const r = await poster({ kcalBrulees: 2_640.4, jour: "2026-09-05" });
    expect(r.status).toBe(200);
    const appel = table.upsert.mock.calls[0][0];
    expect(appel.where).toEqual({ userId_jour: { userId: "u1", jour: "2026-09-05" } });
    // Arrondi à l'entier : la colonne est un entier, et une montre ne rend
    // jamais de décimale de toute façon.
    expect(appel.create.kcalBrulees).toBe(2_640);
    expect(appel.update.kcalBrulees).toBe(2_640);
  });

  it("remplace celle du jour plutôt que d'en écrire une seconde", async () => {
    // `upsert` et non `create` : on relève sa montre le soir, et si on la
    // relève deux fois c'est la seconde qui compte.
    await poster({ kcalBrulees: 2_600 });
    expect(table.upsert).toHaveBeenCalledTimes(1);
  });

  /**
   * Le refus qui compte, et il DIT ce qu'il attend.
   *
   * Une montre affiche les calories ACTIVES et la dépense TOTALE de la
   * journée ; six cents est un très bon jour d'exercice et une dépense de
   * journée impossible. « Dépense invalide » enverrait retaper le même
   * chiffre.
   */
  it("refuse les calories actives prises pour le total, en le disant", async () => {
    const r = await poster({ kcalBrulees: 600 });
    expect(r.status).toBe(400);
    expect((await corps(r)).error).toBe("Dépense de la journée entière attendue");
  });

  it("distingue ce refus du refus ordinaire", async () => {
    // Sans profil, aucun métabolisme à comparer : le refus redevient
    // générique, et il ne prétend pas savoir laquelle des deux valeurs c'est.
    session.mockResolvedValue(utilisateur({ id: "u1" }));
    const r = await poster({ kcalBrulees: 600 });
    expect((await corps(r)).error).toBe("Dépense invalide");
  });

  it("refuse ce qu'aucun corps ne dépense", async () => {
    expect((await poster({ kcalBrulees: 99_999 })).status).toBe(400);
    expect(table.upsert).not.toHaveBeenCalled();
  });

  /**
   * Le type se vérifie AVANT la conversion : `JSON.stringify(NaN)` rend
   * `null`, et `Number(null)` vaut zéro. Une valeur que le navigateur n'a pas
   * su écrire arriverait comme une dépense de zéro.
   */
  it("refuse ce qui n'est pas un nombre", async () => {
    for (const v of [null, "2600", [], {}, true]) {
      expect((await poster({ kcalBrulees: v })).status).toBe(400);
    }
    expect(table.upsert).not.toHaveBeenCalled();
  });

  it("refuse un corps illisible", async () => {
    const r = await POST(new Request("http://x/api/depense", {
      method: "POST", body: '{"kcal', headers: { "content-type": "application/json" },
    }));
    expect(r.status).toBe(400);
    expect((await corps(r)).error).toBe("Corps illisible");
  });

  /**
   * « 2026-02-30 » a la bonne FORME et n'existe pas. Sans le contrôle par
   * aller-retour, il resterait en base pour toujours sur une date qu'aucun
   * calendrier ne contient, et rien ne le compterait jamais.
   */
  it("retombe sur aujourd'hui quand le jour n'existe pas", async () => {
    await poster({ kcalBrulees: 2_600, jour: "2026-02-30" });
    expect(table.upsert.mock.calls[0][0].where.userId_jour.jour).toBe(jourLocal());
  });

  it("refuse une dépense datée du futur", async () => {
    const r = await poster({ kcalBrulees: 2_600, jour: "2099-01-01" });
    expect(r.status).toBe(400);
    expect(table.upsert).not.toHaveBeenCalled();
  });

  it("rend la liste du demandeur, et d'elle seule", async () => {
    await poster({ kcalBrulees: 2_600 });
    expect(table.findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });
});
