/**
 * Les doublures vivent HORS de la fabrique, et leur nom commence par `mock`.
 *
 * `jest.resetModules()` recrée le registre : sans ça, chaque rechargement du
 * module sous test recevait une NOUVELLE doublure de base, et les compteurs
 * qu'on interroge ici restaient ceux de l'ancienne. Les quatre épreuves
 * tombaient sur « undefined », ce qui ne ressemblait pas à sa cause.
 *
 * Le préfixe `mock` est ce que jest autorise à traverser le hissage de
 * `jest.mock`.
 */
const mockRoles = jest.fn();
const mockPaliers = jest.fn();
const mockMaitrise = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    roleWeight: { findMany: mockRoles },
    levelConfig: { findMany: mockPaliers },
    masteryConfig: { findFirst: mockMaitrise },
  },
}));

const base = {
  roleWeight: { findMany: mockRoles },
  levelConfig: { findMany: mockPaliers },
  masteryConfig: { findFirst: mockMaitrise },
};

/**
 * Le barème est global et ne change qu'à la main : le relire à chaque partie
 * enregistrée coûtait trois allers-retours vers la base pour des valeurs qui
 * ne bougent pas d'un mois sur l'autre.
 *
 * Le module est rechargé à chaque cas : son cache vit au niveau du module, et
 * le laisser traverser deux épreuves les rendrait dépendantes de leur ordre.
 */
async function neuf() {
  jest.resetModules();
  return import("./baremeConfig");
}

const PALIERS = [{ niveau: 1, seuilGainageSec: 30 }, { niveau: 2, seuilGainageSec: 60 }];
const ROLES = [{ role: "Mid" }];

beforeEach(() => {
  jest.clearAllMocks();
  base.roleWeight.findMany.mockResolvedValue(ROLES);
  base.levelConfig.findMany.mockResolvedValue(PALIERS);
  base.masteryConfig.findFirst.mockResolvedValue({ id: "x", surchargeMax: 0.5, partiesPourMax: 100 });
});

describe("le barème", () => {
  it("ne lit la base qu'une fois pour deux appels", () => {
    return neuf().then(async ({ chargerBareme }) => {
      await chargerBareme();
      await chargerBareme();
      expect(base.levelConfig.findMany).toHaveBeenCalledTimes(1);
      expect(base.roleWeight.findMany).toHaveBeenCalledTimes(1);
      expect(base.masteryConfig.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  it("rend bien les trois tables", () => {
    return neuf().then(async ({ chargerBareme }) => {
      const b = await chargerBareme();
      expect(b.levelConfigs).toEqual(PALIERS);
      expect(b.roleWeights).toEqual(ROLES);
      expect(b.masteryConfig?.partiesPourMax).toBe(100);
    });
  });

  it("relit après un oubli", () => {
    /**
     * C'est ce qui permet à l'administrateur de voir sa modification tout de
     * suite : sans cet oubli, il continuerait de lire l'ancien barème pendant
     * une minute sur l'écran même où il vient de le changer.
     */
    return neuf().then(async ({ chargerBareme, oublierBareme }) => {
      await chargerBareme();
      oublierBareme();
      await chargerBareme();
      expect(base.levelConfig.findMany).toHaveBeenCalledTimes(2);
    });
  });

  it("ne met PAS en cache un barème vide", () => {
    /**
     * Sur une base neuve, l'amorçage n'a pas encore eu lieu au premier appel.
     * Garder ce vide une minute ferait échouer tout ce qui calcule un score,
     * avec « Config manquante » sur une base semée quelques millisecondes plus
     * tard — c'est exactement le défaut déjà rencontré sur ce projet.
     */
    return neuf().then(async ({ chargerBareme }) => {
      base.levelConfig.findMany.mockResolvedValue([]);
      base.roleWeight.findMany.mockResolvedValue([]);
      await chargerBareme();
      base.levelConfig.findMany.mockResolvedValue(PALIERS);
      base.roleWeight.findMany.mockResolvedValue(ROLES);
      const b = await chargerBareme();
      expect(base.levelConfig.findMany).toHaveBeenCalledTimes(2);
      expect(b.levelConfigs).toEqual(PALIERS);
    });
  });
});
