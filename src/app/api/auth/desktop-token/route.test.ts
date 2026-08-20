import { corps } from "@/test/api";

/** Cookies vus par la route, réécrits par chaque test. */
let magasin: { name: string; value: string }[] = [];
/** Cookies supprimés par la réponse, dans l'ordre. */
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

import { POST } from "./route";
import { auth } from "@/auth";
import { COOKIE_TOUR_DESKTOP } from "@/lib/cookies";

const session = auth as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  magasin = [];
  supprimes.length = 0;
});

const avecTour = (quand: number) => magasin.push({ name: COOKIE_TOUR_DESKTOP, value: String(quand) });
const avecJeton = (valeur = "jeton.de.session") =>
  magasin.push({ name: "authjs.session-token", value: valeur });
const connecte = (connexion: number) =>
  session.mockResolvedValue({ user: { id: "u1", connexion } });

/**
 * Cette route sort le jeton de session du navigateur pour le donner à
 * l'application desktop. C'est le seul endroit de l'application où un secret
 * de session traverse une frontière : chaque garde-fou compte, et chacun a
 * été ajouté après un incident réel.
 */
describe("POST /api/auth/desktop-token", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    avecTour(Date.now());
    expect((await POST()).status).toBe(401);
  });

  it("refuse quand le cookie de session est introuvable", async () => {
    connecte(Date.now());
    avecTour(Date.now());
    const r = await POST();
    expect(r.status).toBe(401);
    expect((await corps(r)).jwt).toBeUndefined();
  });

  it("refuse sans tour de connexion ouvert", async () => {
    // Sans cette borne, c'est la session qui traînait déjà dans le navigateur
    // qu'on expédiait : l'application repartait avec un compte non choisi.
    connecte(Date.now());
    avecJeton();
    const r = await POST();
    expect(r.status).toBe(409);
    expect((await corps(r)).raison).toBe("sans-tour");
  });

  it("refuse une session ouverte avant la demande", async () => {
    const maintenant = Date.now();
    connecte(maintenant - 60_000);
    avecTour(maintenant);
    avecJeton();
    const r = await POST();
    expect(r.status).toBe(409);
    expect((await corps(r)).raison).toBe("session-anterieure");
  });

  it("délivre le jeton pour une session ouverte après la demande", async () => {
    const maintenant = Date.now();
    avecTour(maintenant);
    connecte(maintenant + 500);
    avecJeton("abc.def.ghi");
    const r = await POST();
    expect(r.status).toBe(200);
    expect((await corps(r)).jwt).toBe("abc.def.ghi");
  });

  it("tolère la dérive entre deux instances", async () => {
    // Les deux instants viennent du serveur : la marge n'absorbe plus une
    // horloge de poste mal réglée, seulement quelques millisecondes de dérive.
    const maintenant = Date.now();
    avecTour(maintenant);
    connecte(maintenant - 1000);
    avecJeton();
    expect((await POST()).status).toBe(200);
  });

  it("consomme le tour, quelle que soit l'issue", async () => {
    // À usage unique : sans cela, un tour ouvert une fois resterait valable et
    // le deuxième appel repartirait avec un jeton sans nouvelle connexion.
    const maintenant = Date.now();
    avecTour(maintenant);
    connecte(maintenant + 10);
    avecJeton();
    await POST();
    expect(supprimes).toContain(COOKIE_TOUR_DESKTOP);

    supprimes.length = 0;
    connecte(maintenant - 99_999);
    await POST();
    expect(supprimes).toContain(COOKIE_TOUR_DESKTOP);
  });

  it("recolle un cookie de session découpé en morceaux", async () => {
    // Au-delà d'environ 4 ko, Auth.js répartit le jeton sur des cookies
    // numérotés. Lire le seul nom de base rendait `undefined`, et le transfert
    // échouait sans que rien ne le signale.
    const maintenant = Date.now();
    avecTour(maintenant);
    connecte(maintenant + 10);
    magasin.push({ name: "authjs.session-token.1", value: "DEUX" });
    magasin.push({ name: "authjs.session-token.0", value: "UN" });
    expect((await corps(await POST())).jwt).toBe("UNDEUX");
  });

  it("préfère le cookie préfixé, celui de la production", async () => {
    const maintenant = Date.now();
    avecTour(maintenant);
    connecte(maintenant + 10);
    magasin.push({ name: "authjs.session-token", value: "local" });
    magasin.push({ name: "__Secure-authjs.session-token", value: "production" });
    expect((await corps(await POST())).jwt).toBe("production");
  });

  it("ignore un tour illisible", async () => {
    connecte(Date.now());
    magasin.push({ name: COOKIE_TOUR_DESKTOP, value: "avant-hier" });
    avecJeton();
    const r = await POST();
    expect(r.status).toBe(409);
    expect((await corps(r)).raison).toBe("sans-tour");
  });
});
