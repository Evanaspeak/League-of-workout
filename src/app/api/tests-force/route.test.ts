import { utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { testForce: { findMany: jest.fn() } },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const lire = prisma.testForce.findMany as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  lire.mockResolvedValue([
    { jour: "2026-07-01", pompes: 24 },
    { jour: "2026-08-01", pompes: 30 },
  ]);
});

describe("GET /api/tests-force", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(lire).not.toHaveBeenCalled();
  });

  it("ne lit que les tests du demandeur", async () => {
    await GET();
    expect(lire.mock.calls[0][0].where).toEqual({ userId: "moi" });
  });

  /**
   * L'ordre est celui du TEMPS, et il vient de la base.
   *
   * Une courbe dont les points arrivent dans le désordre ne se trace pas : elle
   * se replie sur elle-même. Le trier au navigateur serait une seconde
   * arithmétique du jour à côté de celle-ci, et c'est ce que ce journal
   * reproche partout.
   */
  it("rend les points du plus ancien au plus récent", async () => {
    await GET();
    expect(lire.mock.calls[0][0].orderBy).toEqual({ jour: "asc" });
  });

  /**
   * Le `select` est une PROJECTION, et pas une politesse.
   *
   * `NextResponse.json(ligne)` publie tout ce qu'on lui remet — c'est la
   * leçon de `lignesBrutes.test.ts`. Ici l'identifiant et l'horodatage de
   * création n'ont aucun lecteur : ce qui traverse le réseau sans être lu est
   * du volume payé pour rien avant d'être un risque.
   */
  it("ne publie que le jour et le nombre", async () => {
    await GET();
    expect(lire.mock.calls[0][0].select).toEqual({ jour: true, pompes: true });
  });

  it("borne la lecture", async () => {
    await GET();
    expect(lire.mock.calls[0][0].take).toBeGreaterThan(0);
  });

  it("rend les points tels quels", async () => {
    const res = await GET();
    expect(await res.json()).toEqual({
      tests: [
        { jour: "2026-07-01", pompes: 24 },
        { jour: "2026-08-01", pompes: 30 },
      ],
    });
  });
});
