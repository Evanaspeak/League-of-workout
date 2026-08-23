import { requete } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { user: { findMany: jest.fn(), update: jest.fn() } },
}));
jest.mock("@/lib/push", () => ({ notifier: jest.fn().mockResolvedValue(1) }));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn() }));

import { POST, HEURE_RAPPEL, MINIMUM_SEC } from "./route";
import { prisma } from "@/lib/prisma";
import { notifier } from "@/lib/push";
import { appliquerRatios, RATIOS_DEFAUT } from "@/lib/exercices";

const user = prisma.user as unknown as { findMany: jest.Mock; update: jest.Mock };

/**
 * La route interroge la base deux fois : une pour le rappel du matin, une pour
 * la relance des absents. Les deux passent par `findMany` sur le même modèle,
 * et une doublure unique servirait les mêmes lignes aux deux — la seconde
 * requête recevrait alors des comptes sans leurs parties. On les distingue par
 * ce qu'elles demandent, ce qui est aussi la seule façon de vérifier qu'elles
 * demandent bien deux choses différentes.
 */
function repondre({ matin = [] as unknown[], absents = [] as unknown[] } = {}) {
  user.findMany.mockImplementation(async (args: { select?: { games?: unknown } }) =>
    args?.select?.games ? absents : matin);
}
const envoi = notifier as jest.Mock;

const SECRET = "un-secret-de-test";

/**
 * Un fuseau où il est neuf heures à l'instant du test, et un autre où il ne
 * l'est pas. Les calculer plutôt que de les écrire en dur : un test qui fige
 * l'heure d'exécution passe le matin et échoue le soir.
 */
function fuseauOuIlEst(heureVoulue: number): string {
  const maintenant = new Date();
  for (const f of Intl.supportedValuesOf("timeZone")) {
    const h = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: f, hour: "numeric", hour12: false,
    }).format(maintenant)) % 24;
    if (h === heureVoulue) return f;
  }
  throw new Error(`aucun fuseau à ${heureVoulue} h`);
}

const AU_MATIN = fuseauOuIlEst(HEURE_RAPPEL);
const AILLEURS = fuseauOuIlEst((HEURE_RAPPEL + 5) % 24);

const compte = (champs: Record<string, unknown> = {}) => ({
  id: "u1", dettePointsDus: 100, exercices: ["boxe"], langue: "fr",
  fuseau: AU_MATIN, ...champs,
});

const appeler = (secret?: string) => POST(requete("/api/push/matin", {
  method: "POST",
  headers: secret === undefined ? {} : { "x-rappel-secret": secret },
}));

beforeEach(() => {
  jest.clearAllMocks();
  appliquerRatios(RATIOS_DEFAUT);
  process.env.RAPPEL_SECRET = SECRET;
  repondre({ matin: [compte()] });
  user.update.mockResolvedValue({});
  envoi.mockResolvedValue(1);
});

describe("porte", () => {
  it("refuse sans le secret", async () => {
    expect((await appeler()).status).toBe(401);
    expect((await appeler("mauvais")).status).toBe(401);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("refuse quand aucun secret n'est configuré", async () => {
    // Une variable oubliée en production ne doit pas transformer un
    // déclencheur en porte ouverte à qui connaît l'adresse.
    delete process.env.RAPPEL_SECRET;
    expect((await appeler(SECRET)).status).toBe(401);
  });
});

describe("choix des comptes", () => {
  it("ne demande à la base que ceux qui doivent quelque chose et ont un fuseau", async () => {
    await appeler(SECRET);
    expect(user.findMany.mock.calls[0][0].where).toEqual({
      dettePointsDus: { gt: 0 }, fuseau: { not: null },
    });
  });

  it("envoie à qui est au matin chez lui", async () => {
    const r = await appeler(SECRET);
    expect(envoi).toHaveBeenCalledTimes(1);
    expect(await r.json()).toEqual({ examines: 1, envoyes: 1, relances: 0 });
  });

  it("ne réveille personne ailleurs dans le monde", async () => {
    // C'est tout l'objet du fuseau : sans lui, « le matin » en UTC est le
    // milieu de la nuit pour une partie des comptes.
    repondre({ matin: [compte({ fuseau: AILLEURS })] });
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("laisse tranquille une dette minuscule", async () => {
    // Une poignée de secondes d'effort ne justifie pas une notification.
    repondre({ matin: [compte({ dettePointsDus: 1 })] });
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
    // Le seuil est bien celui qu'on croit : 1 point de boxe fait 7 s.
    expect(MINIMUM_SEC).toBeGreaterThan(7);
  });

  it("ignore un compte dont aucun exercice ne s'accumule", async () => {
    // Les pompes se font dans la foulée : il n'y a rien en attente.
    repondre({ matin: [compte({ exercices: ["pompes"] })] });
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });
});

describe("robustesse", () => {
  it("continue après un envoi qui échoue", async () => {
    // Une boucle sur tous les comptes : le premier abonnement périmé les
    // arrêterait tous.
    envoi.mockRejectedValueOnce(new Error("abonnement mort")).mockResolvedValue(1);
    repondre({ matin: [compte({ id: "u1" }), compte({ id: "u2" })] });
    const r = await appeler(SECRET);
    expect(envoi).toHaveBeenCalledTimes(2);
    expect((await r.json()).envoyes).toBe(1);
  });

  it("écrit dans la langue du compte", async () => {
    repondre({ matin: [compte({ langue: "ja" })] });
    await appeler(SECRET);
    expect(envoi.mock.calls[0][1].titre).toMatch(/[぀-ヿ一-鿿]/);
  });
});

/**
 * La relance des absents.
 *
 * Elle ne compte pas la dette : quelqu'un qui n'a pas joué depuis deux
 * semaines n'a rien accumulé. Ce qu'on lui dit, c'est le nombre de jours.
 */
describe("relance des absents", () => {
  const absent = (jours: number, champs: Record<string, unknown> = {}) => ({
    id: "a1", langue: "fr", fuseau: AU_MATIN, relanceLe: null,
    games: [{ createdAt: new Date(Date.now() - jours * 24 * 3600_000) }],
    ...champs,
  });

  it("part après deux semaines sans une partie", async () => {
    repondre({ absents: [absent(20)] });
    const r = await appeler(SECRET);
    expect((await r.json()).relances).toBe(1);
    expect(envoi.mock.calls[0][1].tag).toBe("wow-relance");
    expect(envoi.mock.calls[0][1].titre).toContain("20");
  });

  it("se tait sur quelqu'un qui joue encore", async () => {
    repondre({ absents: [absent(3)] });
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("ne redit rien à quelqu'un déjà relancé", async () => {
    repondre({ absents: [absent(40, { relanceLe: new Date(Date.now() - 2 * 24 * 3600_000) })] });
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("ne relance pas un compte qui n'a jamais joué", async () => {
    // Il n'est pas parti, il n'est jamais arrivé.
    repondre({ absents: [absent(40, { games: [] })] });
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("marque la date même quand personne n'a reçu la notification", async () => {
    // Sans abonnement, réessayer chaque jour ne changerait rien et referait
    // le tour de la base toutes les vingt-quatre heures.
    envoi.mockResolvedValue(0);
    repondre({ absents: [absent(20)] });
    await appeler(SECRET);
    expect(user.update).toHaveBeenCalledTimes(1);
    expect(user.update.mock.calls[0][0].where).toEqual({ id: "a1" });
  });

  it("lit la date d'enregistrement, pas celle de la partie", async () => {
    // Une partie ajoutée à la main se date dans le passé : lire `date`
    // ferait paraître absent quelqu'un qui vient de rattraper sa soirée.
    await appeler(SECRET);
    const requeteAbsents = user.findMany.mock.calls.find(
      (c: [{ select?: { games?: unknown } }]) => c[0]?.select?.games);
    expect(requeteAbsents[0].select.games.orderBy).toEqual({ createdAt: "desc" });
  });
});
