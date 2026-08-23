import { requete } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { user: { findMany: jest.fn(), update: jest.fn() } },
}));
jest.mock("@/lib/email", () => ({ envoyerBilanHebdo: jest.fn().mockResolvedValue(true) }));

import { POST, HEURE_BILAN, JOUR_BILAN } from "./route";
import { prisma } from "@/lib/prisma";
import { envoyerBilanHebdo } from "@/lib/email";

const user = prisma.user as unknown as { findMany: jest.Mock; update: jest.Mock };
const envoi = envoyerBilanHebdo as jest.Mock;

const SECRET = "un-secret-de-test";

/**
 * Une horloge arrêtée un lundi matin.
 *
 * La première version cherchait un fuseau où il était, à l'instant du test,
 * lundi neuf heures — et sautait quatre tests sur cinq du mardi au dimanche.
 * Quatre tests qui ne tournent qu'un jour sur sept ne protègent rien : c'est
 * le reste de la semaine qu'on livre. On fige donc l'instant, et le fuseau
 * devient une constante ordinaire.
 */
const LUNDI_MATIN = new Date("2026-08-24T07:00:00Z"); // lundi, 9 h à Paris
const PARIS = "Europe/Paris";
const AILLEURS = "Asia/Tokyo";                        // 16 h au même instant

const partie = () => ({
  createdAt: LUNDI_MATIN, result: "D", pompesCalculees: 30,
});

const compte = (champs: Record<string, unknown> = {}) => ({
  id: "u1", email: "joueur@example.test", pseudo: "Joueur", langue: "fr",
  fuseau: PARIS, bilanLe: null, dettePointsDus: 40,
  games: [partie()], paiements: [], ...champs,
});

const appeler = (secret?: string) => POST(requete("/api/mail/hebdo", {
  method: "POST",
  headers: secret === undefined ? {} : { "x-rappel-secret": secret },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: LUNDI_MATIN });
  process.env.RAPPEL_SECRET = SECRET;
  user.findMany.mockResolvedValue([compte()]);
  user.update.mockResolvedValue({});
  envoi.mockResolvedValue(true);
});

afterEach(() => { jest.useRealTimers(); });

it("l'horloge du test tombe bien sur l'heure et le jour visés", () => {
  // Sans ce contrôle, une constante déplacée rendrait tous les cas ci-dessous
  // silencieusement vides : ils passeraient en n'envoyant jamais rien.
  const h = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS, hour: "numeric", hour12: false,
  }).format(LUNDI_MATIN)) % 24;
  expect(h).toBe(HEURE_BILAN);
  expect(LUNDI_MATIN.getUTCDay()).toBe(JOUR_BILAN);
});

describe("porte", () => {
  it("refuse sans le secret", async () => {
    expect((await appeler()).status).toBe(401);
    expect((await appeler("mauvais")).status).toBe(401);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("refuse quand aucun secret n'est configuré", async () => {
    delete process.env.RAPPEL_SECRET;
    expect((await appeler(SECRET)).status).toBe(401);
  });
});

describe("choix des comptes", () => {
  it("écarte dès la requête ceux à qui on n'écrira pas", async () => {
    // Les comptes « pseudo + code » n'ont pas d'adresse, et celui qui a coupé
    // le bilan n'a pas à être rapporté pour être jeté ensuite : ce serait
    // lire toute la base pour rien.
    await appeler(SECRET);
    expect(user.findMany.mock.calls[0][0].where).toEqual({
      email: { not: null }, fuseau: { not: null }, bilanActif: true,
    });
  });

  it("ne réveille personne ailleurs dans le monde", async () => {
    // Au même instant il est seize heures à Tokyo : le bilan n'y part pas.
    user.findMany.mockResolvedValue([compte({ fuseau: AILLEURS })]);
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("n'écrit rien un autre jour de la semaine", async () => {
    // Le jour se lit dans le fuseau de la personne : à neuf heures à Tokyo,
    // il est encore dimanche à Paris.
    jest.setSystemTime(new Date("2026-08-23T07:00:00Z")); // dimanche
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("n'écrit rien sur une semaine sans une partie", async () => {
    // Un courriel qui dit zéro est celui qu'on se désabonne en l'ouvrant.
    user.findMany.mockResolvedValue([compte({ games: [] })]);
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("ne réécrit pas à quelqu'un servi hier", async () => {
    user.findMany.mockResolvedValue([
      compte({ bilanLe: new Date(LUNDI_MATIN.getTime() - 24 * 3600_000) }),
    ]);
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });
});

describe("envoi", () => {
  it("part à qui est lundi matin chez lui", async () => {
    const r = await appeler(SECRET);
    expect(envoi).toHaveBeenCalledTimes(1);
    expect(await r.json()).toEqual({ examines: 1, envoyes: 1 });
  });

  it("dit qu'il reste quelque chose quand la dette n'est pas soldée", async () => {
    await appeler(SECRET);
    expect(envoi.mock.calls[0][4]).toBe(true);
    jest.clearAllMocks();
    user.findMany.mockResolvedValue([compte({ dettePointsDus: 0 })]);
    user.update.mockResolvedValue({});
    await appeler(SECRET);
    expect(envoi.mock.calls[0][4]).toBe(false);
  });

  it("marque la date même quand l'envoi échoue", async () => {
    // Sans ça, un rejet serait retenté à chaque heure de la journée.
    envoi.mockRejectedValue(new Error("adresse morte"));
    const r = await appeler(SECRET);
    expect(user.update).toHaveBeenCalledTimes(1);
    expect((await r.json()).envoyes).toBe(0);
  });

  it("continue après un rejet", async () => {
    envoi.mockRejectedValueOnce(new Error("adresse morte")).mockResolvedValue(true);
    user.findMany.mockResolvedValue([compte({ id: "u1" }), compte({ id: "u2" })]);
    const r = await appeler(SECRET);
    expect(envoi).toHaveBeenCalledTimes(2);
    expect((await r.json()).envoyes).toBe(1);
  });
});
