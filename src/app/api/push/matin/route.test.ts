import { requete } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: jest.fn() } } }));
jest.mock("@/lib/push", () => ({ notifier: jest.fn().mockResolvedValue(1) }));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn() }));

import { POST, HEURE_RAPPEL, MINIMUM_SEC } from "./route";
import { prisma } from "@/lib/prisma";
import { notifier } from "@/lib/push";
import { appliquerRatios, RATIOS_DEFAUT } from "@/lib/exercices";

const user = prisma.user as unknown as { findMany: jest.Mock };
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
  user.findMany.mockResolvedValue([compte()]);
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
    expect(await r.json()).toEqual({ examines: 1, envoyes: 1 });
  });

  it("ne réveille personne ailleurs dans le monde", async () => {
    // C'est tout l'objet du fuseau : sans lui, « le matin » en UTC est le
    // milieu de la nuit pour une partie des comptes.
    user.findMany.mockResolvedValue([compte({ fuseau: AILLEURS })]);
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("laisse tranquille une dette minuscule", async () => {
    // Une poignée de secondes d'effort ne justifie pas une notification.
    user.findMany.mockResolvedValue([compte({ dettePointsDus: 1 })]);
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
    // Le seuil est bien celui qu'on croit : 1 point de boxe fait 7 s.
    expect(MINIMUM_SEC).toBeGreaterThan(7);
  });

  it("ignore un compte dont aucun exercice ne s'accumule", async () => {
    // Les pompes se font dans la foulée : il n'y a rien en attente.
    user.findMany.mockResolvedValue([compte({ exercices: ["pompes"] })]);
    await appeler(SECRET);
    expect(envoi).not.toHaveBeenCalled();
  });
});

describe("robustesse", () => {
  it("continue après un envoi qui échoue", async () => {
    // Une boucle sur tous les comptes : le premier abonnement périmé les
    // arrêterait tous.
    envoi.mockRejectedValueOnce(new Error("abonnement mort")).mockResolvedValue(1);
    user.findMany.mockResolvedValue([compte({ id: "u1" }), compte({ id: "u2" })]);
    const r = await appeler(SECRET);
    expect(envoi).toHaveBeenCalledTimes(2);
    expect((await r.json()).envoyes).toBe(1);
  });

  it("écrit dans la langue du compte", async () => {
    user.findMany.mockResolvedValue([compte({ langue: "ja" })]);
    await appeler(SECRET);
    expect(envoi.mock.calls[0][1].titre).toMatch(/[぀-ヿ一-鿿]/);
  });
});
