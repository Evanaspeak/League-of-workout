import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findMany: jest.fn() },
    goal: { findUnique: jest.fn() },
    // Les paliers du test de force voyagent avec les statistiques depuis
    // qu'un aller-retour a été retiré du premier rendu.
    levelConfig: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET as tableauDeBord } from "./route";
import { GET as journee } from "./daily/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const game = prisma.game as unknown as { findMany: jest.Mock };

/** Une partie plausible, telle que la base la rend. */
const partie = (champs: Record<string, unknown> = {}) => ({
  id: "g1", userId: "u1", date: new Date("2026-08-19T21:30:00Z"),
  role: "MID", champion: "Ahri", kills: 2, deaths: 9, assists: 4,
  result: "D", gainageSec: 60, niveauCalcule: 3, pompesCalculees: 38,
  exercice: "pompes", repartition: null, jeu: "League of Legends",
  typeJeu: "parties", source: "manuel", ...champs,
});

const niveaux = prisma.levelConfig as unknown as { findMany: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  niveaux.findMany.mockResolvedValue([]);
  session.mockResolvedValue(utilisateur({ exercices: ["pompes"] }));
  game.findMany.mockResolvedValue([partie()]);
  (prisma.goal.findUnique as jest.Mock).mockResolvedValue({ objectifTotalPompes: 1000 });
});

const dash = (q = "") => tableauDeBord(requete("/api/dashboard" + q));
const jour = (q: string) => journee(requete("/api/dashboard/daily" + q));

describe("GET /api/dashboard", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await dash()).status).toBe(401);
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("ne lit que les parties du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await dash();
    expect(game.findMany.mock.calls[0][0].where).toEqual({ userId: "u42" });
  });

  it("rend le test de force du demandeur, et rien d'autre", async () => {
    // Ces trois valeurs ont rejoint la réponse pour épargner un aller-retour
    // au premier rendu. Elles viennent du compte : elles doivent venir de
    // CELUI qui demande, et la réponse ne doit rien porter de plus intime.
    session.mockResolvedValue(utilisateur({
      id: "u42", pompesMax: 27, pompesMaxLe: new Date("2026-08-01T10:00:00Z"),
      passwordHash: "ne-doit-pas-sortir", codeHash: "ne-doit-pas-sortir",
    }));
    game.findMany.mockResolvedValue([]);
    const corpsRendu = await corps(await dash());
    expect(corpsRendu.pompesMax).toBe(27);
    expect(corpsRendu.pompesMaxLe).toEqual(new Date("2026-08-01T10:00:00Z").toISOString());
    const rendu = JSON.stringify(corpsRendu);
    expect(rendu).not.toContain("ne-doit-pas-sortir");
    expect(rendu).not.toContain("passwordHash");
    expect(rendu).not.toContain("codeHash");
  });

  it("rend un tableau de bord vide sans planter", async () => {
    // Le premier écran que voit un inscrit : il ne doit pas tomber en erreur
    // parce qu'il n'y a encore rien à afficher.
    game.findMany.mockResolvedValue([]);
    (prisma.goal.findUnique as jest.Mock).mockResolvedValue(null);
    const r = await dash();
    expect(r.status).toBe(200);
    expect(await corps(r)).toBeTruthy();
  });

  it("compte le total d'effort", async () => {
    game.findMany.mockResolvedValue([partie(), partie({ id: "g2", pompesCalculees: 12 })]);
    const brut = JSON.stringify(await corps(await dash()));
    expect(brut).toContain("50");
  });
});

describe("GET /api/dashboard/daily", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await jour("?date=2026-08-19")).status).toBe(401);
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("refuse une date absente ou mal formée", async () => {
    for (const q of ["", "?date=hier", "?date=2026-8-9", "?date=2026-08-19T10:00"]) {
      expect((await jour(q)).status).toBe(400);
    }
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("borne la requête à la journée demandée, et au demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await jour("?date=2026-08-19");
    const where = game.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u42");
    expect(where.date.gte.toISOString()).toBe("2026-08-19T00:00:00.000Z");
    expect(where.date.lte.toISOString()).toBe("2026-08-19T23:59:59.999Z");
  });

  it("ne rend aucune heure quand la journée est vide", async () => {
    // Les heures sans effort sont écartées : le graphique montre la soirée
    // réellement jouée, pas vingt-quatre colonnes dont vingt-deux à zéro.
    game.findMany.mockResolvedValue([]);
    const d = await corps(await jour("?date=2026-08-19")) as { hourly: unknown[]; total: number; games: number };
    expect(d.hourly).toHaveLength(0);
    expect(d.total).toBe(0);
    expect(d.games).toBe(0);
  });

  it("range l'effort à la bonne heure", async () => {
    const d = await corps(await jour("?date=2026-08-19")) as { hourly: { label: string; total: number }[] };
    expect(d.hourly).toEqual([{ label: "21h", total: 38 }]);
  });

  it("cumule plusieurs parties dans la même heure", async () => {
    game.findMany.mockResolvedValue([
      partie(),
      partie({ id: "g2", date: new Date("2026-08-19T21:52:00Z"), pompesCalculees: 12 }),
      partie({ id: "g3", date: new Date("2026-08-19T23:05:00Z"), pompesCalculees: 5 }),
    ]);
    const d = await corps(await jour("?date=2026-08-19")) as { hourly: { label: string; total: number }[]; total: number };
    expect(d.hourly).toEqual([{ label: "21h", total: 50 }, { label: "23h", total: 5 }]);
    expect(d.total).toBe(55);
  });
});

/**
 * L'énergie dépensée ne se calcule qu'avec le consentement.
 *
 * La politique de confidentialité l'écrit noir sur blanc : sans lui, cette
 * estimation n'est pas affichée. Un engagement qu'on ne tient qu'à moitié n'en
 * est pas un, et le poids relève de l'article 9.
 */
describe("énergie dépensée", () => {
  beforeEach(() => {
    game.findMany.mockResolvedValue([partie()]);
  });

  it("ne sort pas sans consentement, même si le poids est en base", async () => {
    session.mockResolvedValue(utilisateur({ poids: 78, santeConsentiLe: null }));
    const r = await corps(await tableauDeBord(requete("/api/dashboard")));
    expect(r.calories).toBeNull();
  });

  it("ne sort pas avec le consentement mais sans poids", async () => {
    session.mockResolvedValue(utilisateur({ poids: null, santeConsentiLe: new Date() }));
    const r = await corps(await tableauDeBord(requete("/api/dashboard")));
    expect(r.calories).toBeNull();
  });

  it("sort quand les deux sont là, avec son équivalence en marche", async () => {
    session.mockResolvedValue(utilisateur({ poids: 78, santeConsentiLe: new Date() }));
    const r = await corps(await tableauDeBord(requete("/api/dashboard")));
    const c = r.calories as { total: number; marcheMin: number } | null;
    expect(c).not.toBeNull();
    expect(c!.total).toBeGreaterThan(0);
    expect(c!.marcheMin).toBeGreaterThan(0);
  });
});

