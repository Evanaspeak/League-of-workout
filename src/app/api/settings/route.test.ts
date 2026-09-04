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

  it("retient la langue du compte", async () => {
    // Le serveur n'a aucun autre moyen de savoir dans quelle langue écrire :
    // le stockage du navigateur ne lui est pas visible.
    const r = await put({ userPrefs: { langue: "ja" } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.langue).toBe("ja");
  });

  it("refuse une langue hors des six", async () => {
    const r = await put({ userPrefs: { langue: "it" } });
    expect(r.status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("laisse couper le bilan hebdomadaire", async () => {
    // Un envoi récurrent sans bouton d'arrêt n'est pas un service rendu.
    const r = await put({ userPrefs: { bilanActif: false } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.bilanActif).toBe(false);
  });

  it("refuse autre chose qu'un booléen pour le bilan", async () => {
    const r = await put({ userPrefs: { bilanActif: "oui" } });
    expect(r.status).toBe(400);
  });

  it("enregistre le mode fantôme", async () => {
    const r = await put({ userPrefs: { fantome: true } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.fantome).toBe(true);
  });

  /**
   * Refusé plutôt que ramené à `false` par une conversion. C'est un réglage de
   * confidentialité : enregistrer « visible » pour quelqu'un qui vient de
   * demander l'inverse est le seul résultat qu'on ne peut pas rattraper — il
   * croit s'être caché, et il ne le vérifiera jamais.
   */
  it("refuse autre chose qu'un booléen pour le mode fantôme", async () => {
    const r = await put({ userPrefs: { fantome: "oui" } });
    expect(r.status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("ouvrir le profil public tire un jeton, et le rend à l'écran", async () => {
    // L'écran ne peut pas le fabriquer : il est tiré au serveur. Sans lui dans
    // la réponse, il faudrait un second appel pour lire une valeur qu'on vient
    // d'écrire.
    const r = await put({ userPrefs: { profilPublic: true } });
    expect(r.status).toBe(200);
    const jeton = p.user.update.mock.calls[0][0].data.jetonProfil;
    expect(typeof jeton).toBe("string");
    expect((jeton as string).length).toBeGreaterThanOrEqual(24);
    expect(await corps(r)).toMatchObject({ jetonProfil: jeton });
  });

  it("le fermer efface le jeton — fermer, c'est révoquer", async () => {
    const r = await put({ userPrefs: { profilPublic: false } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.jetonProfil).toBeNull();
    expect(await corps(r)).toMatchObject({ jetonProfil: null });
  });

  /**
   * Même raison que le mode fantôme : c'est un réglage de confidentialité, et
   * enregistrer « ouvert » pour quelqu'un qui vient de demander l'inverse est
   * le seul résultat qu'on ne peut pas rattraper.
   */
  it("refuse autre chose qu'un booléen pour le profil public", async () => {
    const r = await put({ userPrefs: { profilPublic: "oui" } });
    expect(r.status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("une requête sans ce réglage ne rend aucun jeton", async () => {
    // Une clé absente ne dit rien ; une clé nulle dirait « fermé », et l'écran
    // effacerait un lien qui existe toujours.
    const r = await put({ userPrefs: { bilanActif: true } });
    const lu = await corps(r);
    expect(lu).not.toHaveProperty("jetonProfil");
  });

  it("enregistre ce qu'un ami a le droit de voir", async () => {
    const r = await put({ userPrefs: { partageAmis: "detail" } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.partageAmis).toBe("detail");
  });

  /**
   * Refusé plutôt que ramené au défaut. Le défaut est le plus FERMÉ, donc une
   * conversion silencieuse serait sûre — mais elle enregistrerait « total »
   * pour quelqu'un qui vient de demander « détail », et il croirait avoir
   * ouvert quand il a fermé. Un réglage qu'on ne vérifie jamais doit dire
   * quand il n'a pas pris.
   */
  it.each(["tout", "DETAIL", "", 42, true, null])(
    "refuse %p comme valeur de partage",
    async (valeur) => {
      const r = await put({ userPrefs: { partageAmis: valeur } });
      expect(r.status).toBe(400);
      expect(p.user.update).not.toHaveBeenCalled();
    },
  );

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
