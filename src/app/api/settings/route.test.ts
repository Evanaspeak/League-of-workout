import { requete, corps, utilisateur, admin } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: jest.fn() },
    goal: { upsert: jest.fn(), findUnique: jest.fn() },
    roleWeight: { findMany: jest.fn(), update: jest.fn() },
    levelConfig: { findMany: jest.fn(), update: jest.fn() },
    masteryConfig: { findFirst: jest.fn(), update: jest.fn() },
    testForce: { upsert: jest.fn() },
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

  /**
   * Le partage entre exercices (réponse 068).
   *
   * Un poids hors bornes se REFUSE et ne se ramène pas : « trois fois plus »
   * et « dix fois plus » ne se ressemblent pas, et enregistrer l'un pour
   * l'autre en silence rendrait le réglage inutile. C'est la règle déjà posée
   * pour la conduite au démarrage d'un jeu, et pour le mode fantôme.
   */
  it("accepte des poids dans les bornes", async () => {
    const r = await put({ userPrefs: { partsExercices: '{"pompes":3,"squats":1}' } });
    expect(r.status).toBe(200);
    expect(p.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ partsExercices: '{"pompes":3,"squats":1}' }),
    }));
  });

  it("accepte null, qui remet le partage à parts égales", async () => {
    const r = await put({ userPrefs: { partsExercices: null } });
    expect(r.status).toBe(200);
    expect(p.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ partsExercices: null }),
    }));
  });

  it.each([
    ["zéro, qui se dit déjà en décochant", '{"pompes":0}'],
    ["au-dessus du plafond", '{"pompes":11}'],
    ["un poids qui n'est pas entier", '{"pompes":1.5}'],
    ["un poids qui n'est pas un nombre", '{"pompes":"beaucoup"}'],
    ["du JSON cassé", "{pompes:"],
    ["un tableau", "[1,2]"],
  ])("refuse %s", async (_titre, brut) => {
    const r = await put({ userPrefs: { partsExercices: brut } });
    expect(r.status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("refuse un poids posé sur un exercice inconnu", async () => {
    const r = await put({ userPrefs: { partsExercices: '{"licorne":2}' } });
    expect(r.status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  /**
   * Le barème PERSONNEL (réponse 047, « Oui, par utilisateur »).
   *
   * Mêmes refus que le partage juste au-dessus, et pour la même raison : « deux
   * fois plus dur » et « dix fois plus dur » ne se ressemblent pas, donc un
   * ratio hors bornes se refuse au lieu de se ramener en silence.
   *
   * Deux contrôles portent ce que la fusion ne peut pas distinguer d'elle-même.
   * Les POMPES sont refusées et non ramenées : `RATIO_BORNES.pompes` vaut
   * `{ min: 1, max: 1 }`, donc l'arithmétique les remettrait à un de toute
   * façon — et le réglage aurait alors l'air d'avoir pris. Et un ratio n'est
   * PAS un entier : deux secondes et demie de squats par point est un réglage
   * sensé, que le contrôle du partage aurait rejeté.
   */
  it("accepte un barème dans les bornes, décimales comprises", async () => {
    const r = await put({ userPrefs: { ratiosExercices: '{"squats":2.5,"boxe":12}' } });
    expect(r.status).toBe(200);
    expect(p.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ratiosExercices: '{"squats":2.5,"boxe":12}' }),
    }));
  });

  it("accepte null, qui rend le barème commun", async () => {
    const r = await put({ userPrefs: { ratiosExercices: null } });
    expect(r.status).toBe(200);
    expect(p.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ratiosExercices: null }),
    }));
  });

  it.each([
    ["les pompes, qui sont l'unité de référence", '{"pompes":4}'],
    ["un exercice inconnu", '{"licorne":2}'],
    ["au-dessus du plafond de l'exercice", '{"boxe":9000}'],
    ["en dessous de son plancher", '{"boxe":0}'],
    ["une valeur qui n'est pas un nombre", '{"boxe":"beaucoup"}'],
    ["du JSON cassé", "{boxe:"],
    ["un tableau", "[1,2]"],
  ])("refuse %s dans le barème", async (_titre, brut) => {
    const r = await put({ userPrefs: { ratiosExercices: brut } });
    expect(r.status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  /**
   * Un poids sur un exercice DÉCOCHÉ est accepté : décocher puis recocher ne
   * doit pas effacer le réglage qu'on avait mis. C'est le pendant du gel de
   * `Game.repartition` — ce qui a été choisi ne se réécrit pas tout seul.
   */
  it("accepte un poids sur un exercice qui n'est pas coché", async () => {
    const r = await put({ userPrefs: { partsExercices: '{"corde":4}' } });
    expect(r.status).toBe(200);
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

  it("enregistre le mur des records ouvert à tous", async () => {
    const r = await put({ userPrefs: { recordsPublics: true } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.recordsPublics).toBe(true);
  });

  /**
   * Même refus que pour le mode fantôme, et pour la même raison. Une
   * conversion `Boolean("non")` rend VRAI : quelqu'un qui demande de se
   * refermer serait ouvert, et il ne le vérifiera jamais.
   */
  it.each([["oui"], ["non"], [1], [{}], [null]])(
    "refuse %p pour le mur des records", async (valeur) => {
      const r = await put({ userPrefs: { recordsPublics: valeur } });
      expect(r.status).toBe(400);
      expect(p.user.update).not.toHaveBeenCalled();
    });

  it("enregistre le nom montré aux autres", async () => {
    const r = await put({ userPrefs: { nomAffiche: "riot" } });
    expect(r.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data.nomAffiche).toBe("riot");
  });

  /**
   * Refusé plutôt que ramené au défaut. Le défaut est le plus fermé, donc une
   * conversion serait sûre — mais elle enregistrerait « pseudo » pour
   * quelqu'un qui vient de demander « riot », et il croirait avoir ouvert.
   */
  it("refuse une valeur non prévue pour le nom montré", async () => {
    const r = await put({ userPrefs: { nomAffiche: "twitch" } });
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

/**
 * Le test de force écrit DEUX choses, et c'est délibéré.
 *
 * `User.pompesMax` est la valeur COURANTE, celle qui fixe le niveau donc le
 * multiplicateur ; `TestForce` est l'HISTOIRE, celle qui fait la courbe. Sans
 * elle il n'y avait littéralement rien à tracer, et c'est ce qui bloquait la
 * ligne 152 du plan pendant des mois.
 */
describe("l'histoire du test de force", () => {
  beforeEach(() => {
    session.mockResolvedValue(utilisateur({ id: "moi" }));
  });

  it("range le test dans l'histoire en même temps que dans le compte", async () => {
    await put({ userPrefs: { pompesMax: 42 } });
    expect(p.testForce.upsert).toHaveBeenCalledTimes(1);
    const appel = p.testForce.upsert.mock.calls[0][0];
    expect(appel.create).toMatchObject({ userId: "moi", pompes: 42 });
    expect(appel.update).toEqual({ pompes: 42 });
  });

  /**
   * Le contrôle qui distingue, et lui seul.
   *
   * Deux appels à `new Date()` peuvent tomber de part et d'autre de minuit :
   * la courbe porterait alors un point daté d'un autre jour que « test fait
   * le… » affiché juste au-dessus — deux vérités pour un seul geste. Ici on
   * relit les deux écritures et on exige qu'elles désignent le MÊME jour.
   */
  it("date le point du même jour que le compte", async () => {
    await put({ userPrefs: { pompesMax: 42 } });
    const pose = p.user.update.mock.calls[0][0].data.pompesMaxLe as Date;
    const jour = p.testForce.upsert.mock.calls[0][0].create.jour as string;
    const deux = (n: number) => String(n).padStart(2, "0");
    expect(jour).toBe(
      `${pose.getFullYear()}-${deux(pose.getMonth() + 1)}-${deux(pose.getDate())}`,
    );
  });

  /**
   * L'unicité est posée EN BASE, et l'`upsert` la lit.
   *
   * Refaire son test dans la même journée corrige le point du jour plutôt que
   * d'en ajouter un second : deux points sur la même abscisse ne disent rien
   * d'une progression, et un double clic en fabriquerait un. Un `create` nu
   * échouerait sur la contrainte au lieu de corriger.
   */
  it("corrige le point du jour plutôt que d'en ajouter un second", async () => {
    await put({ userPrefs: { pompesMax: 42 } });
    const appel = p.testForce.upsert.mock.calls[0][0];
    expect(appel.where.userId_jour).toEqual({
      userId: "moi",
      jour: appel.create.jour,
    });
  });

  it("n'écrit rien dans l'histoire quand le chiffre est refusé", async () => {
    const r = await put({ userPrefs: { pompesMax: 100000 } });
    expect(r.status).toBe(400);
    expect(p.testForce.upsert).not.toHaveBeenCalled();
  });

  /**
   * Le témoin : un enregistrement de réglage qui ne touche pas au test ne doit
   * pas poser de point. Sans lui, une écriture inconditionnelle satisferait
   * les quatre contrôles ci-dessus, et la courbe se remplirait d'un point par
   * case cochée.
   */
  it("ne pose rien quand on enregistre autre chose", async () => {
    await put({ userPrefs: { bilanActif: true } });
    expect(p.testForce.upsert).not.toHaveBeenCalled();
  });
});
