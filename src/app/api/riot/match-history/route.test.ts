import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findMany: jest.fn() },
    // La route réserve désormais son coût sur le budget de la clé Riot avant
    // d'appeler quoi que ce soit.
    loginAttempt: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
/** Un PUUID Riot : 78 caractères de l'alphabet base64 URL. */
const PUUID = "a".repeat(78);
const AUTRE_PUUID = "b".repeat(78);

let appels: string[] = [];
const reponse = (corpsJson: unknown, status = 200) =>
  new Response(JSON.stringify(corpsJson), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  jest.clearAllMocks();
  appels = [];
  session.mockResolvedValue(utilisateur({ riotPuuid: PUUID, riotRegion: "EUW1" }));
  (prisma.game.findMany as jest.Mock).mockResolvedValue([]);
  process.env.RIOT_API_KEY = "RGAPI-test";
  global.fetch = jest.fn(async (url: string | URL | Request) => {
    const u = String(url);
    appels.push(u);
    if (u.includes("/ids?")) return reponse(["EUW1_1"]);
    return reponse({
      info: {
        gameEndTimestamp: Date.parse("2026-08-19T21:30:00Z"),
        participants: [
          { puuid: PUUID, championName: "Ahri", kills: 2, deaths: 9, assists: 4, win: false, teamPosition: "MIDDLE" },
          { puuid: AUTRE_PUUID, championName: "Garen", kills: 12, deaths: 1, assists: 3, win: true, teamPosition: "TOP" },
        ],
      },
    });
  }) as unknown as typeof fetch;
});

/**
 * Cette route parle à Riot avec la clé du serveur. Ce qu'elle met dans l'URL
 * vient de la base, donc d'un champ que l'utilisateur a rempli : c'est le seul
 * endroit de l'application où une valeur de compte se retrouve dans une
 * requête sortante privilégiée.
 */
describe("GET /api/riot/match-history", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(appels).toHaveLength(0);
  });

  it("n'appelle pas Riot quand le compte n'a pas de PUUID", async () => {
    session.mockResolvedValue(utilisateur({ riotPuuid: null }));
    const r = await GET();
    expect(r.status).toBe(400);
    expect(appels).toHaveLength(0);
  });

  it("refuse un PUUID mal formé plutôt que de l'envoyer", async () => {
    // Un dièse suffisait à s'approprier le chemin de la requête envoyée sous
    // la clé du serveur. Le compte est renvoyé vers ses réglages.
    for (const mauvais of ["../../admin", "abc#x", "a".repeat(300), ""]) {
      session.mockResolvedValue(utilisateur({ riotPuuid: mauvais }));
      expect((await GET()).status).toBe(400);
    }
    expect(appels).toHaveLength(0);
  });

  it("signale l'absence de clé sans appeler Riot", async () => {
    /**
     * 503 et non 500 : ce n'est pas Riot qui est muet, c'est nous qui ne
     * sommes pas prêts. Le journal de synchronisation distingue les deux ;
     * sans ça il aurait annoncé « Riot ne répond pas » pendant tous les jours
     * qui séparent le lancement de l'arrivée de la clé de production.
     */
    delete process.env.RIOT_API_KEY;
    expect((await GET()).status).toBe(503);
    expect(appels).toHaveLength(0);
  });

  it("ne rapproche l'historique que des parties du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42", riotPuuid: PUUID, riotRegion: "EUW1" }));
    await GET();
    expect((prisma.game.findMany as jest.Mock).mock.calls[0][0].where.userId).toBe("u42");
  });

  it("ne lit que les statistiques du joueur, pas celles de ses adversaires", async () => {
    const d = await corps(await GET()) as unknown as { champion: string; kills: number }[];
    expect(d[0].champion).toBe("Ahri");
    expect(d[0].kills).toBe(2);
  });

  it("remonte l'erreur de Riot avec son propre code", async () => {
    // La route réessaie quatre fois en espaçant les tentatives : le test doit
    // laisser passer ces six secondes d'attente avant de conclure.
    global.fetch = jest.fn(async () => reponse({ status: { message: "Rate limit" } }, 429)) as unknown as typeof fetch;
    expect((await GET()).status).toBe(429);
  }, 20_000);

  it("rend une liste vide quand Riot n'a aucune partie", async () => {
    global.fetch = jest.fn(async () => reponse([])) as unknown as typeof fetch;
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await corps(r)).toEqual([]);
  });

  /**
   * Le budget de la clé, vu depuis la route.
   *
   * Ce qui compte ici, c'est qu'AUCUN appel ne parte : laisser filer la
   * requête pour la voir revenir en 429 déclencherait la reprise automatique,
   * qui multiplie la charge au moment précis où elle est déjà trop haute.
   */
  it("refuse sans appeler Riot quand la clé est saturée", async () => {
    const compteur = (prisma as unknown as { loginAttempt: Record<string, jest.Mock> }).loginAttempt;
    compteur.count.mockImplementation(({ where }: { where: { kind: string } }) =>
      Promise.resolve(where.kind === "riot-cle" ? 90 : 0));
    const avant = appels.length;
    const r = await GET();
    expect(r.status).toBe(429);
    expect(appels.length).toBe(avant);
  });
});
