import { requete, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    roleWeight: { findMany: jest.fn() },
    levelConfig: { findMany: jest.fn() },
    masteryConfig: { findFirst: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));

import { GET as scoring } from "./admin/config/scoring/route";
import { POST as rejouerIntro } from "./admin/users/[id]/intro/route";
import { GET as sessionExpiree } from "./auth/session-expired/route";
import { GET as desktopTermine } from "./auth/desktop-complete/route";
import { POST as sessionVolatile } from "./auth/session-volatile/route";
import { GET as derniereGame } from "./riot/last-game/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { auth } from "@/auth";
import { cookies } from "next/headers";

const session = getCurrentUser as jest.Mock;
const sessionAuth = auth as unknown as jest.Mock;
const magasin = cookies as unknown as jest.Mock;
const compte = prisma.user as unknown as { findUnique: jest.Mock; update: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur());
  (prisma.roleWeight.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.masteryConfig.findFirst as jest.Mock).mockResolvedValue(null);
  compte.findUnique.mockResolvedValue({ id: "u2" });
  compte.update.mockResolvedValue({ introGeneration: 4 });
});

/**
 * Les attributs d'un `Set-Cookie`, en minuscules, sans le couple nom/valeur.
 *
 * Le premier segment porte le nom du cookie ; le chercher dans la chaîne
 * entière fait passer un nom pour un attribut.
 */
function attributs(entete: string): string[] {
  return entete.split(";").slice(1).map((m) => m.trim().split("=")[0].toLowerCase());
}

describe("GET /api/admin/config/scoring", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await scoring()).status).toBe(403);
  });

  it("refuse un compte qui n'est pas administrateur", async () => {
    expect((await scoring()).status).toBe(403);
  });

  it("laisse passer l'administrateur", async () => {
    session.mockResolvedValue(admin());
    expect((await scoring()).status).toBe(200);
  });
});

describe("POST /api/admin/users/[id]/intro", () => {
  const appel = (id: string) =>
    rejouerIntro(requete(`/api/admin/users/${id}/intro`, { method: "POST" }),
      { params: Promise.resolve({ id }) });

  it("refuse un compte qui n'est pas administrateur", async () => {
    expect((await appel("u2")).status).toBe(403);
  });

  it("répond 404 pour un compte inconnu", async () => {
    session.mockResolvedValue(admin());
    compte.findUnique.mockResolvedValue(null);
    expect((await appel("fantome")).status).toBe(404);
  });

  it("incrémente la génération plutôt que d'écrire une valeur", async () => {
    // Les marques « déjà vu » vivent dans le navigateur de l'intéressé : c'est
    // la génération, qui entre dans leur clé, qui les périme. Poser une valeur
    // fixe rendrait l'opération sans effet la deuxième fois.
    session.mockResolvedValue(admin());
    await appel("u2");
    expect(compte.update.mock.calls[0][0].data)
      .toMatchObject({ introGeneration: { increment: 1 } });
  });
});

describe("GET /api/auth/session-expired", () => {
  it("renvoie vers la connexion", async () => {
    const r = await sessionExpiree(requete("/api/auth/session-expired"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("/login");
  });

  it("supprime le cookie préfixé avec son attribut Secure", async () => {
    // Sans `Secure`, le navigateur jette la directive entière pour un nom
    // préfixé `__Secure-` : la session restait ouverte pendant que l'écran
    // annonçait le contraire.
    //
    // On cherche l'ATTRIBUT, pas le mot : le nom du cookie commence lui-même
    // par `__Secure-`, si bien qu'un `toMatch(/Secure/)` trouve toujours et ne
    // vérifie rien. Première rédaction de ce test, et elle survivait au retrait
    // pur et simple de l'attribut.
    const r = await sessionExpiree(requete("/api/auth/session-expired"));
    const poses = r.headers.getSetCookie().filter((c) => c.startsWith("__Secure-"));
    expect(poses.length).toBeGreaterThan(0);
    for (const c of poses) expect(attributs(c)).toContain("secure");
  });
});

describe("GET /api/auth/desktop-complete", () => {
  it("ferme la session du navigateur et renvoie vers la connexion", async () => {
    const r = await desktopTermine(requete("/api/auth/desktop-complete"));
    expect(r.headers.get("location")).toContain("/login?transferred=1");
    const poses = r.headers.getSetCookie().filter((c) => c.startsWith("__Secure-"));
    expect(poses.length).toBeGreaterThan(0);
    for (const c of poses) expect(attributs(c)).toContain("secure");
  });
});

describe("POST /api/auth/session-volatile", () => {
  it("refuse sans session", async () => {
    sessionAuth.mockResolvedValue(null);
    magasin.mockResolvedValue({ getAll: () => [] });
    expect((await sessionVolatile()).status).toBe(401);
  });

  it("réécrit tous les morceaux du jeton découpé", async () => {
    // Au-delà d'environ 4 ko, Auth.js numérote le cookie. N'en réécrire qu'un
    // laisse la session tronquée, donc invalide.
    sessionAuth.mockResolvedValue({ user: { id: "u1" } });
    magasin.mockResolvedValue({
      getAll: () => [
        { name: "authjs.session-token.0", value: "a" },
        { name: "authjs.session-token.1", value: "b" },
        { name: "autre", value: "z" },
      ],
    });
    const r = await sessionVolatile();
    const poses = r.headers.getSetCookie();
    expect(poses.filter((c) => c.startsWith("authjs.session-token."))).toHaveLength(2);
  });

  it("ne pose ni date d'expiration ni durée de vie", async () => {
    // C'est tout l'objet de la route : un cookie sans échéance meurt à la
    // fermeture du navigateur. Une échéance, même longue, le rend persistant —
    // et sur un poste partagé la case décochée ne protège plus de rien.
    sessionAuth.mockResolvedValue({ user: { id: "u1" } });
    magasin.mockResolvedValue({
      getAll: () => [{ name: "authjs.session-token", value: "a" }],
    });
    const r = await sessionVolatile();
    for (const c of r.headers.getSetCookie()) {
      expect(c).not.toMatch(/Expires=/i);
      expect(c).not.toMatch(/Max-Age=/i);
    }
  });
});

describe("GET /api/riot/last-game", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    const r = await derniereGame(requete("/api/riot/last-game"));
    expect(r.status).toBe(401);
  });

  it("refuse un PUUID mal formé plutôt que de l'envoyer chez Riot", async () => {
    // Le PUUID partait brut dans l'URL : un dièse suffisait à s'approprier le
    // chemin comme la requête, envoyés sous la clé du serveur.
    session.mockResolvedValue(utilisateur({ riotPuuid: "abc#/../autre", riotRegion: "euw1" }));
    const r = await derniereGame(requete("/api/riot/last-game"));
    expect(r.status).toBe(400);
  });

  it("refuse un compte sans PUUID", async () => {
    session.mockResolvedValue(utilisateur({ riotPuuid: null }));
    expect((await derniereGame(requete("/api/riot/last-game"))).status).toBe(400);
  });
});
