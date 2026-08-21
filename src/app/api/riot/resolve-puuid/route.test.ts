import { requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { user: { update: jest.fn() } } }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ isRateLimited: jest.fn(), recordAttempt: jest.fn() }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

const session = getCurrentUser as jest.Mock;
const bride = isRateLimited as jest.Mock;
let appels: string[] = [];

const resoudre = (body: unknown) =>
  POST(requete("/api/riot/resolve-puuid", { method: "POST", body }));

beforeEach(() => {
  jest.clearAllMocks();
  appels = [];
  session.mockResolvedValue(utilisateur());
  bride.mockResolvedValue(false);
  (prisma.user.update as jest.Mock).mockResolvedValue({});
  process.env.RIOT_API_KEY = "RGAPI-test";
  global.fetch = jest.fn(async (url: string | URL | Request) => {
    appels.push(String(url));
    return new Response(
      JSON.stringify({ puuid: "p".repeat(78), gameName: "Joueur", tagLine: "EUW" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
});

/**
 * Cette route interroge Riot sous la clé du serveur, partagée par tous les
 * comptes. Sans borne, un seul compte pouvait la vider et priver les autres de
 * la synchronisation automatique.
 */
describe("POST /api/riot/resolve-puuid", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await resoudre({ riotId: "Joueur#EUW", region: "EUW1" })).status).toBe(401);
    expect(appels).toHaveLength(0);
  });

  it("refuse quand le budget de recherches est épuisé", async () => {
    bride.mockResolvedValue(true);
    const r = await resoudre({ riotId: "Joueur#EUW", region: "EUW1" });
    expect(r.status).toBe(429);
    expect(appels).toHaveLength(0);
  });

  it("compte la recherche sur le compte, pas sur le réseau", async () => {
    // C'est le compte qui consomme le quota partagé ; compter l'adresse
    // réseau punirait une salle de jeu entière pour un seul curieux.
    await resoudre({ riotId: "Joueur#EUW", region: "EUW1" });
    expect(recordAttempt).toHaveBeenCalledWith("u1", "riot-lookup");
  });

  it("refuse un Riot ID mal formé sans appeler Riot", async () => {
    for (const riotId of ["", "sansdiese", null, 42]) {
      expect((await resoudre({ riotId, region: "EUW1" })).status).toBe(400);
    }
    expect(appels).toHaveLength(0);
  });

  it("refuse une région inconnue sans appeler Riot", async () => {
    expect((await resoudre({ riotId: "Joueur#EUW", region: "mars1" })).status).toBe(400);
    expect(appels).toHaveLength(0);
  });

  it("n'écrit le PUUID que sur le compte du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await resoudre({ riotId: "Joueur#EUW", region: "EUW1" });
    expect((prisma.user.update as jest.Mock).mock.calls[0][0].where).toEqual({ id: "u42" });
  });
});
