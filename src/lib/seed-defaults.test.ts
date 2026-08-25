const compteurs = { roleWeight: 0, levelConfig: 0, masteryConfig: 0 };
const roleWeight = { count: jest.fn(), createMany: jest.fn() };
const levelConfig = { count: jest.fn(), createMany: jest.fn() };
const masteryConfig = { count: jest.fn(), createMany: jest.fn() };

jest.mock("./prisma", () => ({ prisma: { roleWeight, levelConfig, masteryConfig } }));

/**
 * L'amorçage de la configuration de barème.
 *
 * Le garde de processus ne vaut que pour SON processus : sur une base neuve,
 * plusieurs requêtes arrivent ensemble et les trois comptages rendent zéro
 * partout. Les écritures doivent donc supporter d'être jouées deux fois.
 */

/** Recharge le module : la promesse d'amorçage est mémorisée à son niveau. */
async function chargerSeed() {
  jest.resetModules();
  return (await import("./seed-defaults")).seedDefaults;
}

beforeEach(() => {
  for (const m of [roleWeight, levelConfig, masteryConfig]) {
    m.count.mockReset();
    m.createMany.mockReset().mockResolvedValue({ count: 0 });
  }
  roleWeight.count.mockResolvedValue(compteurs.roleWeight);
  levelConfig.count.mockResolvedValue(compteurs.levelConfig);
  masteryConfig.count.mockResolvedValue(compteurs.masteryConfig);
});

describe("seedDefaults", () => {
  it("sème les trois tables sur une base vide", async () => {
    const seed = await chargerSeed();
    await seed();
    expect(roleWeight.createMany).toHaveBeenCalled();
    expect(levelConfig.createMany).toHaveBeenCalled();
    expect(masteryConfig.createMany).toHaveBeenCalled();
  });

  it("laisse passer un doublon plutôt que de tomber", async () => {
    // C'est tout l'objet : deux instances qui sèment en même temps ne doivent
    // pas se heurter sur une clé primaire, et rendre 500 au premier
    // chargement d'un environnement qu'on vient de monter.
    const seed = await chargerSeed();
    await seed();
    for (const m of [roleWeight, levelConfig, masteryConfig]) {
      expect(m.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    }
  });

  it("nomme l'identifiant de la maîtrise", async () => {
    // Sans identifiant écrit, la base en choisit un par défaut et
    // `skipDuplicates` n'a plus de doublon à reconnaître.
    const seed = await chargerSeed();
    await seed();
    expect(masteryConfig.createMany.mock.calls[0][0].data[0].id).toBe(1);
  });

  it("n'écrit rien quand la configuration est déjà là", async () => {
    roleWeight.count.mockResolvedValue(7);
    levelConfig.count.mockResolvedValue(5);
    masteryConfig.count.mockResolvedValue(1);
    const seed = await chargerSeed();
    await seed();
    for (const m of [roleWeight, levelConfig, masteryConfig]) {
      expect(m.createMany).not.toHaveBeenCalled();
    }
  });

  it("ne compte qu'une fois par processus", async () => {
    const seed = await chargerSeed();
    await Promise.all([seed(), seed(), seed()]);
    expect(roleWeight.count).toHaveBeenCalledTimes(1);
  });

  it("oublie son échec pour que l'appel suivant retente", async () => {
    roleWeight.count.mockRejectedValueOnce(new Error("base injoignable"));
    const seed = await chargerSeed();
    await expect(seed()).rejects.toThrow("base injoignable");
    await expect(seed()).resolves.toBeUndefined();
  });
});
