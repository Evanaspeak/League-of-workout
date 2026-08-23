import { requete, corps, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: jest.fn() },
    goal: { upsert: jest.fn(), findUnique: jest.fn() },
    roleWeight: { findMany: jest.fn(), update: jest.fn() },
    levelConfig: { findMany: jest.fn(), update: jest.fn() },
    masteryConfig: { findFirst: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const p = prisma as unknown as Record<string, Record<string, jest.Mock>>;

const put = (body: unknown) => PUT(requete("/api/settings", { method: "PUT", body }));

/** Un lot de configuration partagée, valide et dans les bornes. */
const CONFIG_PARTAGEE = {
  roleWeights: [{ role: "MID", poidsMort: 2, poidsKill: 1, poidsAssist: 0.5, maitriseActive: true }],
  levelConfigs: [{ niveau: 3, seuilGainageSec: 90, seuilPompes: 30, multiplicateur: 1.2, malusDefaite: 10 }],
  masteryConfig: { surchargeMax: 0.5, partiesPourMax: 100 },
};

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur());
  for (const modele of Object.values(p)) {
    for (const methode of Object.values(modele)) methode.mockResolvedValue({});
  }
  p.roleWeight.findMany.mockResolvedValue([]);
  p.levelConfig.findMany.mockResolvedValue([]);
  p.masteryConfig.findFirst.mockResolvedValue(null);
  p.goal.findUnique.mockResolvedValue(null);
});

const ecrituresPartagees = () =>
  p.roleWeight.update.mock.calls.length +
  p.levelConfig.update.mock.calls.length +
  p.masteryConfig.update.mock.calls.length;

describe("GET /api/settings", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("laisse tout le monde lire la configuration", async () => {
    // Chacun a le droit de savoir comment sa dette est calculée : c'est
    // l'écriture qui est réservée, pas la lecture.
    expect((await GET()).status).toBe(200);
  });
});

/**
 * Poids par rôle, seuils de niveau et surcharge de maîtrise ne sont pas des
 * préférences : ce sont les coefficients qui décident de ce que CHAQUE
 * utilisateur devra physiquement faire. Ils étaient ouverts à n'importe quel
 * compte connecté.
 */
describe("PUT /api/settings — configuration commune à tous les comptes", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await put(CONFIG_PARTAGEE)).status).toBe(401);
    expect(ecrituresPartagees()).toBe(0);
  });

  it("refuse à un compte connecté ordinaire", async () => {
    const r = await put(CONFIG_PARTAGEE);
    expect(r.status).toBe(403);
    expect(ecrituresPartagees()).toBe(0);
  });

  it("refuse chaque branche prise séparément", async () => {
    for (const branche of [
      { roleWeights: CONFIG_PARTAGEE.roleWeights },
      { levelConfigs: CONFIG_PARTAGEE.levelConfigs },
      { masteryConfig: CONFIG_PARTAGEE.masteryConfig },
    ]) {
      expect((await put(branche)).status).toBe(403);
    }
    expect(ecrituresPartagees()).toBe(0);
  });

  it("laisse passer l'administration", async () => {
    session.mockResolvedValue(admin());
    expect((await put(CONFIG_PARTAGEE)).status).toBe(200);
    expect(ecrituresPartagees()).toBe(3);
  });

  it("borne les valeurs même pour l'administration", async () => {
    // Un multiplicateur démesuré rendait un score que la colonne entière ne
    // sait pas écrire, et plus personne ne pouvait enregistrer de partie.
    session.mockResolvedValue(admin());
    const r = await put({ masteryConfig: { surchargeMax: 999, partiesPourMax: 100 } });
    expect(r.status).toBe(400);
    expect(String((await corps(r)).error)).toMatch(/bornes/);
  });

  it("refuse un diviseur nul, qui rendait un score inécrivable", async () => {
    session.mockResolvedValue(admin());
    expect((await put({ masteryConfig: { surchargeMax: 0.5, partiesPourMax: 0 } })).status).toBe(400);
  });
});

describe("PUT /api/settings — préférences personnelles", () => {
  it("reste ouvert à tout le monde", async () => {
    const r = await put({ userPrefs: { exercices: ["pompes", "boxe"] } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.exercices).toEqual(["pompes", "boxe"]);
  });

  it("n'écrit que sur le compte du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await put({ userPrefs: { exercices: ["pompes"] } });
    expect(p.user.update.mock.calls[0][0].where).toEqual({ id: "u42" });
  });

  it("refuse un exercice inconnu", async () => {
    const r = await put({ userPrefs: { exercices: ["cyclisme"] } });
    expect(r.status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("refuse une sélection vide, qui ne laisserait aucun moyen de payer", async () => {
    expect((await put({ userPrefs: { exercices: [] } })).status).toBe(400);
  });

  it("refuse un seuil de rappel absurde", async () => {
    const r = await put({ userPrefs: { rappelSeuilSec: -50 } });
    expect(r.status).toBe(400);
  });

  it("refuse un test de pompes absurde", async () => {
    const r = await put({ userPrefs: { pompesMax: 100000 } });
    expect(r.status).toBe(400);
  });

  it("accepte la variante d'exécution des pompes", async () => {
    const r = await put({ userPrefs: { variantePompes: "genoux" } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.variantePompes).toBe("genoux");
  });

  it("accepte de la retirer", async () => {
    // Le geste qu'on fait le jour où on n'en a plus besoin. `null` doit
    // arriver jusqu'à la base : un `undefined` laisserait le réglage en place
    // et l'historique continuerait de s'annoter.
    const r = await put({ userPrefs: { variantePompes: null } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.variantePompes).toBeNull();
  });

  it("refuse une variante inconnue", async () => {
    const r = await put({ userPrefs: { variantePompes: "sur une main" } });
    expect(r.status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
  });
});

/**
 * Les mesures physiques sont des données de santé : la route ne les écrit
 * qu'avec le consentement explicite, quelle que soit l'interface qui appelle.
 */
describe("mesures physiques", () => {
  const mesures = (userPrefs: Record<string, unknown>) => put({ userPrefs });

  it("refuse sans consentement, et n'écrit rien", async () => {
    session.mockResolvedValue(utilisateur({ santeConsentiLe: null }));
    const r = await mesures({ poids: 78 });
    expect(r.status).toBe(403);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("écrit avec le consentement", async () => {
    session.mockResolvedValue(utilisateur({ santeConsentiLe: new Date() }));
    const r = await mesures({ poids: 78, taille: 180, age: 27, genre: "homme", sportsHoursPerWeek: 4 });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data).toMatchObject({
      poids: 78, taille: 180, age: 27, genre: "homme", sportsHoursPerWeek: 4,
    });
  });

  it("laisse vider un champ sans retirer le consentement", async () => {
    session.mockResolvedValue(utilisateur({ santeConsentiLe: new Date() }));
    await mesures({ poids: null, taille: "" });
    expect(p.user.update.mock.calls[0][0].data).toMatchObject({ poids: null, taille: null });
  });

  it("borne chaque mesure, et rejette un genre inconnu", async () => {
    session.mockResolvedValue(utilisateur({ santeConsentiLe: new Date() }));
    for (const prefs of [{ poids: 5 }, { poids: 900 }, { taille: 12 }, { age: 4 },
                         { sportsHoursPerWeek: 200 }, { genre: "autre chose" }]) {
      expect((await mesures(prefs)).status).toBe(400);
    }
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("accepte « non précisé », qui est une valeur et non une absence", async () => {
    session.mockResolvedValue(utilisateur({ santeConsentiLe: new Date() }));
    expect((await mesures({ genre: "non-precise" })).status).toBe(200);
  });

  it("écrit sur le compte de la session", async () => {
    session.mockResolvedValue(utilisateur({ santeConsentiLe: new Date() }));
    await mesures({ poids: 80 });
    expect(p.user.update.mock.calls[0][0].where).toEqual({ id: "u1" });
  });
});
