import { requete, corps } from "@/test/api";

/** Cookies vus par les routes qui manipulent la session. */
let magasin: { name: string; value: string }[] = [];
const supprimes: string[] = [];

jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) => magasin.find((c) => c.name === nom),
    getAll: () => magasin,
  }),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/cookies", () => {
  const reel = jest.requireActual("@/lib/cookies");
  return { ...reel, supprimerCookie: (_r: unknown, nom: string) => { supprimes.push(nom); } };
});
jest.mock("@/lib/prisma", () => ({
  prisma: { systemConfig: { findUnique: jest.fn() }, user: { update: jest.fn() } },
}));
// L'amorçage écrit la configuration de scoring : ce qui est éprouvé ici est la
// porte, pas ce qu'elle laisse faire une fois ouverte.
jest.mock("@/lib/seed-defaults", () => ({ seedDefaults: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/exercicesConfig", () => ({
  chargerRatios: jest.fn().mockResolvedValue({ pompes: 1, squats: 2, boxe: 9 }),
}));

import { POST as ouvrirTour } from "./auth/desktop-round/route";
import { GET as listerChampions } from "./champions/route";
import { GET as lireRatios } from "./exercices/ratios/route";
import { GET as initialiser } from "./init/route";
import { prisma } from "@/lib/prisma";
import { COOKIES_SESSION, COOKIE_TOUR_DESKTOP } from "@/lib/cookies";
import { CHAMPIONS } from "@/lib/champions";

const config = prisma.systemConfig as unknown as { findUnique: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  magasin = [];
  supprimes.length = 0;
  config.findUnique.mockResolvedValue(null);
});

/**
 * Ouvre un tour de connexion pour l'application desktop. Elle doit d'abord
 * faire place nette : Auth.js, quand un cookie de session traîne, rattache le
 * compte choisi à l'utilisateur courant au lieu de le connecter.
 */
describe("POST /api/auth/desktop-round", () => {
  it("efface toutes les formes du cookie de session", async () => {
    await ouvrirTour();
    for (const base of COOKIES_SESSION) expect(supprimes).toContain(base);
  });

  it("efface aussi les morceaux d'un cookie découpé", async () => {
    // Au-delà d'environ 4 ko le jeton est réparti sur des cookies numérotés :
    // n'effacer que le nom de base laissait une session lisible derrière soi.
    magasin = [
      { name: `${COOKIES_SESSION[0]}.0`, value: "UN" },
      { name: `${COOKIES_SESSION[0]}.1`, value: "DEUX" },
      { name: "sans-rapport", value: "x" },
    ];
    await ouvrirTour();
    expect(supprimes).toContain(`${COOKIES_SESSION[0]}.0`);
    expect(supprimes).toContain(`${COOKIES_SESSION[0]}.1`);
    expect(supprimes).not.toContain("sans-rapport");
  });

  it("date le tour sur l'horloge du serveur", async () => {
    // Cet horodatage se compare à celui que la connexion inscrira dans le
    // jeton. Les deux doivent venir de la même horloge : la borne vivait
    // autrefois sur le poste, et quelques secondes d'avance suffisaient à
    // faire refuser une connexion valide.
    const avant = Date.now();
    const r = await ouvrirTour();
    const pose = r.cookies.get(COOKIE_TOUR_DESKTOP);
    expect(pose).toBeDefined();
    const valeur = Number(pose?.value);
    expect(valeur).toBeGreaterThanOrEqual(avant);
    expect(valeur).toBeLessThanOrEqual(Date.now());
  });

  it("borne la validité du tour à dix minutes", async () => {
    const r = await ouvrirTour();
    expect(r.cookies.get(COOKIE_TOUR_DESKTOP)?.maxAge).toBe(600);
  });

  it("garde le tour hors de portée du JavaScript de page", async () => {
    const r = await ouvrirTour();
    expect(r.cookies.get(COOKIE_TOUR_DESKTOP)?.httpOnly).toBe(true);
  });
});

describe("GET /api/champions", () => {
  it("sert la liste livrée quand rien n'est configuré", async () => {
    const d = await corps(await listerChampions()) as unknown as string[];
    expect(d).toEqual(CHAMPIONS);
  });

  it("sert la liste réglée en administration", async () => {
    config.findUnique.mockResolvedValue({ value: JSON.stringify(["Ahri", "Zed"]) });
    expect(await corps(await listerChampions())).toEqual(["Ahri", "Zed"]);
  });

  it("retombe sur la liste livrée si la ligne est illisible ou vide", async () => {
    for (const value of ["{pas du JSON", "[]", '"Ahri"']) {
      config.findUnique.mockResolvedValue({ value });
      expect(await corps(await listerChampions())).toEqual(CHAMPIONS);
    }
  });

  it("survit à une base injoignable", async () => {
    config.findUnique.mockRejectedValue(new Error("base injoignable"));
    const r = await listerChampions();
    expect(r.status).toBe(200);
    expect(await corps(r)).toEqual(CHAMPIONS);
  });
});

describe("GET /api/exercices/ratios", () => {
  it("sert les ratios en vigueur sans demander de session", async () => {
    // Ces trois nombres voyagent déjà dans le HTML de chaque page : exiger une
    // session rendrait la route inutilisable depuis la page d'accueil.
    const r = await lireRatios();
    expect(r.status).toBe(200);
    expect((await corps(r)).ratios).toEqual({ pompes: 1, squats: 2, boxe: 9 });
  });

  /**
   * Ce test disait l'inverse, et il avait figé le défaut comme une garantie.
   *
   * La route porte `public, max-age=60, stale-while-revalidate=300`, ce qui
   * défait exactement ce pour quoi elle existe : le navigateur relit la valeur
   * à la source parce que celle du HTML peut dater — et il se servait dans son
   * propre cache, donc il réinstallait l'ancienne par-dessus la bonne.
   *
   * Ce que ça donnait à l'écran : la pastille de dette convertissait les
   * points avec l'ancien ratio pendant que le décompte affichait la durée
   * calculée au serveur avec le nouveau. « 6 min 05 » sur l'une, « 2 min 41 »
   * dans l'autre, sur le même écran, et le rapport entre les deux valait
   * exactement celui des deux ratios.
   *
   * `public` est le mot qui coûte le plus cher : il autorise le CDN à garder
   * la réponse pour tout le monde, pas seulement pour celui qui l'a demandée.
   */
  it("ne se met jamais en cache", async () => {
    const r = await lireRatios();
    const cache = r.headers.get("Cache-Control") ?? "";
    expect(cache).toContain("no-store");
    expect(cache).not.toContain("public");
    expect(cache).not.toMatch(/max-age=[1-9]/);
    expect(cache).not.toContain("stale-while-revalidate");
  });
});

/**
 * Écrit la configuration de scoring sans qu'aucun compte soit connecté : elle
 * sert au tout premier démarrage. Sa seule protection est un secret partagé.
 */
describe("GET /api/init", () => {
  const appeler = (q = "") => initialiser(requete("/api/init" + q));

  it("refuse tant qu'aucun secret n'est configuré", async () => {
    delete process.env.INIT_SECRET;
    expect((await appeler()).status).toBe(503);
  });

  it("refuse sans le secret, ou avec le mauvais", async () => {
    process.env.INIT_SECRET = "le-bon-secret";
    for (const q of ["", "?secret=", "?secret=faux"]) {
      expect((await appeler(q)).status).toBe(401);
    }
  });

  it("accepte le secret par en-tête aussi", async () => {
    process.env.INIT_SECRET = "le-bon-secret";
    const r = await initialiser(requete("/api/init", { headers: { "x-init-secret": "le-bon-secret" } }));
    expect(r.status).toBe(200);
  });

  it("n'amorce rien quand elle refuse", async () => {
    process.env.INIT_SECRET = "le-bon-secret";
    await appeler("?secret=faux");
    expect(jest.requireMock("@/lib/seed-defaults").seedDefaults).not.toHaveBeenCalled();
  });
});
