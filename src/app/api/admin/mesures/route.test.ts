import { corps, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: jest.fn() } } }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const findMany = (prisma as unknown as { user: { findMany: jest.Mock } }).user.findMany;

const jour = (n: number) => new Date(`2026-08-${String(n).padStart(2, "0")}T12:00:00Z`);

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(admin());
  findMany.mockResolvedValue([]);
});

/** La route fait deux lectures : les comptes, puis la veille de volume. */
const deuxLectures = (comptes: unknown[], veille: unknown[]) => {
  findMany.mockReset();
  findMany.mockResolvedValueOnce(comptes).mockResolvedValueOnce(veille);
};

describe("accès", () => {
  it("refuse sans session et hors administration", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(403);
    session.mockResolvedValue(utilisateur());
    expect((await GET()).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("lecture", () => {
  it("demande la date d'enregistrement, jamais la date de partie", async () => {
    // C'est tout l'objet de la mesure : une partie rattrapée se date la
    // veille, et le délai en ressortirait négatif.
    await GET();
    const select = JSON.stringify(findMany.mock.calls[0][0].select);
    expect(select).toContain("createdAt");
    expect(select).not.toMatch(/"date"/);
  });

  it("compte les jours distincts, pas les parties", async () => {
    findMany.mockResolvedValue([{
      createdAt: jour(1),
      // Trois parties, deux jours.
      games: [
        { createdAt: jour(2) },
        { createdAt: new Date("2026-08-02T20:00:00Z") },
        { createdAt: jour(5) },
      ],
    }]);
    const m = await corps(await GET());
    expect(m.revenus).toBe(1);
    expect(m.avecPartie).toBe(1);
  });

  it("ne compte pas comme revenu celui qui a tout fait le même jour", async () => {
    findMany.mockResolvedValue([{
      createdAt: jour(1),
      games: [{ createdAt: jour(2) }, { createdAt: new Date("2026-08-02T23:00:00Z") }],
    }]);
    expect((await corps(await GET())).revenus).toBe(0);
  });

  it("survit à une base sans aucun compte", async () => {
    const m = await corps(await GET());
    expect(m.comptes).toBe(0);
    expect(m.delai).toMatchObject({ median: null });
  });
});

/**
 * La veille de volume, côté administration.
 *
 * L'application réclame de l'effort après une défaite : elle peut servir à se
 * punir. Le message de prévention part côté joueur ; celui-ci existe pour que
 * quelqu'un puisse regarder.
 */
describe("veille de volume", () => {
  it("ne retient que les comptes au-dessus du seuil", async () => {
    deuxLectures([], [
      { pseudo: "Beaucoup", games: [{ pompesCalculees: 4000 }, { pompesCalculees: 3000 }] },
      { pseudo: "Normal", games: [{ pompesCalculees: 300 }] },
    ]);
    const r = await corps(await GET());
    const veille = r.veille as { pseudo: string; points: number }[];
    expect(veille).toHaveLength(1);
    expect(veille[0]).toEqual({ pseudo: "Beaucoup", points: 7000 });
  });

  it("ne fait pas sortir l'adresse électronique", async () => {
    // Le pseudo suffit à retrouver le compte dans la liste voisine.
    deuxLectures([], [{ pseudo: "Beaucoup", games: [{ pompesCalculees: 9000 }] }]);
    const texte = JSON.stringify(await corps(await GET()));
    expect(texte).not.toMatch(/@/);
    expect(JSON.stringify(findMany.mock.calls[1][0].select)).not.toMatch(/email/i);
  });

  it("rend une liste vide quand personne ne dépasse", async () => {
    deuxLectures([], [{ pseudo: "Normal", games: [{ pompesCalculees: 100 }] }]);
    expect((await corps(await GET())).veille).toEqual([]);
  });
});

