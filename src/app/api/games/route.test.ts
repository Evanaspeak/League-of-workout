import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    roleWeight: { findMany: jest.fn() },
    levelConfig: { findMany: jest.fn() },
    masteryConfig: { findFirst: jest.fn() },
  },
}));
// La configuration de barème est semée par la route quand elle manque : ici
// la base est doublée, il n'y a rien à semer.
jest.mock("@/lib/seed-defaults", () => ({ seedDefaults: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ isRateLimited: jest.fn(), recordAttempt: jest.fn() }));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn() }));
jest.mock("@/lib/push", () => ({ notifier: jest.fn().mockResolvedValue(undefined) }));

import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { notifier } from "@/lib/push";

const session = getCurrentUser as jest.Mock;
const bride = isRateLimited as jest.Mock;
const game = prisma.game as unknown as { findMany: jest.Mock; create: jest.Mock; count: jest.Mock };
const user = prisma.user as unknown as { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };

/** Configuration de scoring minimale mais cohérente, comme en base. */
const NIVEAUX = [1, 2, 3, 4, 5].map((niveau) => ({
  niveau,
  seuilGainageSec: niveau * 30,
  seuilPompes: niveau * 20,
  // Un multiplicateur franc rend les attentes lisibles : ce qui est vérifié
  // ici, c'est la route, pas le barème — le barème a ses propres tests.
  multiplicateur: 2,
  malusDefaite: 10,
}));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ pompesMax: 20 }));
  bride.mockResolvedValue(false);
  game.findMany.mockResolvedValue([]);
  game.count.mockResolvedValue(0);
  game.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "g1", ...data }));
  user.findUnique.mockResolvedValue({ dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"] });
  user.update.mockResolvedValue({ dettePointsDus: 40 });
  user.updateMany.mockResolvedValue({ count: 1 });
  (prisma.roleWeight.findMany as jest.Mock).mockResolvedValue([
    { role: "MID", poidsKill: 1, poidsMort: 2, poidsAssist: 0.5, maitriseActive: true },
  ]);
  (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue(NIVEAUX);
  (prisma.masteryConfig.findFirst as jest.Mock).mockResolvedValue({ surchargeMax: 0.5, partiesPourMax: 100 });
});

const post = (body: unknown) => POST(requete("/api/games", { method: "POST", body }));

const partie = (extra: Record<string, unknown> = {}) => ({
  jeu: "League of Legends", role: "MID", champion: "Ahri",
  kills: 2, deaths: 9, assists: 4, result: "D", ...extra,
});

describe("GET /api/games", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("ne rend que les parties du demandeur", async () => {
    // La seule protection entre comptes est ce filtre : s'il disparaît, la
    // route sert l'historique de tout le monde sans que rien ne change à
    // l'écran de celui qui l'a demandé.
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await GET();
    expect(game.findMany.mock.calls[0][0].where).toEqual({ userId: "u42" });
  });
});

describe("POST /api/games", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await post(partie())).status).toBe(401);
    expect(game.create).not.toHaveBeenCalled();
  });

  it("refuse quand le budget d'écriture est épuisé", async () => {
    bride.mockResolvedValue(true);
    const r = await post(partie());
    expect(r.status).toBe(429);
    expect(game.create).not.toHaveBeenCalled();
  });

  it("compte la tentative avant d'écrire", async () => {
    await post(partie());
    expect(recordAttempt).toHaveBeenCalledWith("u1", "game-write");
  });

  it("écrit la partie au nom du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42", pompesMax: 20 }));
    await post(partie());
    expect(game.create.mock.calls[0][0].data.userId).toBe("u42");
  });

  it("refuse une date dans le futur", async () => {
    const demain = new Date(Date.now() + 86_400_000).toISOString();
    const r = await post(partie({ date: demain }));
    expect(r.status).toBe(400);
    expect(String((await corps(r)).error)).toMatch(/futur/);
    expect(game.create).not.toHaveBeenCalled();
  });

  it("accepte une date passée et la garde", async () => {
    await post(partie({ date: "2026-01-02T21:30" }));
    expect(game.create.mock.calls[0][0].data.date).toBeInstanceOf(Date);
  });

  it("refuse une durée nulle sur un jeu compté au temps", async () => {
    const r = await post({ jeu: "Minecraft", dureeSec: 0 });
    expect(r.status).toBe(400);
    expect(game.create).not.toHaveBeenCalled();
  });

  it("enregistre une session au temps", async () => {
    const r = await post({ jeu: "Minecraft", dureeSec: 3600 });
    expect(r.status).toBe(200);
    const data = game.create.mock.calls[0][0].data;
    expect(data.typeJeu).toBe("temps");
    expect(data.dureeSec).toBe(3600);
    expect(data.pompesCalculees).toBeGreaterThan(0);
  });

  /**
   * Une base neuve, où la configuration de barème n'existe pas encore.
   *
   * Elle n'était semée que par `/api/user` : quelqu'un qui enregistre une
   * partie avant d'avoir ouvert un écran qui lit son compte tombait sur une
   * erreur 500 — et pas une erreur propre, une pile d'appels. `getLevel` lit
   * le dernier élément d'une liste triée ; sur une liste vide il rend
   * `undefined`, et la lecture du seuil qui suit fait tomber la route.
   *
   * Trouvé par un test navigateur, en intégration continue, parce qu'un
   * nouveau fichier de parcours est passé avant les autres dans l'ordre
   * alphabétique et n'appelait pas `/api/user`. Le défaut existait depuis
   * longtemps ; il fallait juste que quelque chose arrive dans le bon ordre.
   */
  it("sème la configuration quand elle manque", async () => {
    await post(partie());
    expect(jest.requireMock("@/lib/seed-defaults").seedDefaults).toHaveBeenCalled();
  });

  it("rend une erreur lisible plutôt qu'une pile d'appels sans les paliers", async () => {
    (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([]);
    const r = await post(partie());
    expect(r.status).toBe(500);
    expect((await corps(r)).error).toBe("Config manquante");
  });

  /**
   * Les bornes de saisie.
   *
   * Sans elles, `999999999` secondes de Minecraft au lieu de `999` produisait
   * 5 555 556 points de dette en une requête. Ce n'est pas un abus, c'est un
   * zéro de trop dans un champ — et la personne se retrouvait avec une dette
   * qu'elle ne pourrait jamais payer, sur un produit dont c'est le sujet.
   */
  it("refuse une durée de session déraisonnable", async () => {
    const r = await post({ jeu: "Minecraft", typeJeu: "temps", dureeSec: 999_999_999 });
    expect(r.status).toBe(400);
    expect(game.create).not.toHaveBeenCalled();
  });

  it("accepte une longue soirée, jusqu'à trente-six heures", async () => {
    // Il s'agit d'attraper l'impossible, pas de discuter l'exploit.
    expect((await post({ jeu: "Minecraft", typeJeu: "temps", dureeSec: 24 * 3600 })).status).toBe(200);
  });

  it("refuse un KDA hors bornes plutôt que de tomber", async () => {
    // `Number(body.deaths) || 0` laissait passer 1e308 jusqu'à la base, qui
    // répondait par une erreur 500 sans rien expliquer.
    for (const aberrant of [1e308, 1_000_000_000, -5]) {
      const r = await post(partie({ deaths: aberrant }));
      expect(r.status).toBe(400);
    }
    expect(game.create).not.toHaveBeenCalled();
  });

  it("laisse un KDA absent valoir zéro", async () => {
    // « absent » et « aberrant » sont deux choses différentes.
    const r = await post({ jeu: "League of Legends", role: "MID", champion: "Ahri", result: "D" });
    expect(r.status).toBe(200);
    expect(game.create.mock.calls[0][0].data.kills).toBe(0);
  });

  it("refuse un classement aberrant plutôt que d'en faire une victoire", async () => {
    // `Math.max(1, …)` ramenait un « -3 » à la première place, c'est-à-dire à
    // une partie gratuite : la saisie aberrante était récompensée.
    for (const aberrant of [-3, 0, 100000, "abc"]) {
      const r = await post({ jeu: "Apex Legends", kills: 0, placement: aberrant, joueurs: 60 });
      expect(r.status).toBe(400);
    }
    expect(game.create).not.toHaveBeenCalled();
  });

  it("refuse un battle royale sans classement", async () => {
    const r = await post({ jeu: "Apex Legends", kills: 3 });
    expect(r.status).toBe(400);
  });

  /**
   * Le résultat se refuse, il ne se suppose pas.
   *
   * `body.result === "V" ? "V" : "D"` faisait d'un champ absent, d'une casse
   * différente ou d'un `undefined` remonté par Riot une défaite silencieuse.
   * Une victoire enregistrée en défaite crée une dette non méritée, et rien
   * ne le signalait : la partie s'enregistrait, simplement du mauvais côté.
   */
  describe("le résultat", () => {
    it.each([
      ["absent", undefined],
      ["en minuscule", "v"],
      ["écrit en toutes lettres", "Victoire"],
      ["booléen", true],
      ["nul", null],
    ])("refuse un résultat %s au lieu de le compter comme une défaite", async (_cas, valeur) => {
      const r = await post({
        jeu: "League of Legends", role: "MID", champion: "Ahri",
        kills: 2, deaths: 9, assists: 4, result: valeur,
      });
      expect(r.status).toBe(400);
      expect(game.create).not.toHaveBeenCalled();
    });

    it.each(["V", "D"])("accepte « %s »", async (valeur) => {
      const r = await post({
        jeu: "League of Legends", role: "MID", champion: "Ahri",
        kills: 2, deaths: 9, assists: 4, result: valeur,
      });
      expect(r.status).toBe(200);
      expect(game.create.mock.calls[0][0].data.result).toBe(valeur);
    });
  });

  /**
   * Un rôle inconnu accusait le serveur.
   *
   * « MID » au lieu de « Mid » rendait « Config manquante » en 500, ce qui
   * envoie chercher une panne de base alors que tout est en place. Trouvé en
   * se servant du produit, précisément parce que le message m'a fait douter
   * de la base.
   */
  it("refuse un rôle inconnu sans accuser la configuration", async () => {
    const r = await post({
      // Le double doublé de `RoleWeight` ne connaît que « MID ».
      jeu: "League of Legends", role: "Mid", champion: "Ahri",
      kills: 2, deaths: 9, assists: 4, result: "D",
    });
    expect(r.status).toBe(400);
    expect(await corps(r)).toEqual({ error: "Rôle inconnu" });
    expect(game.create).not.toHaveBeenCalled();
  });

  it("déduit la victoire du classement en battle royale", async () => {
    await post({ jeu: "Apex Legends", kills: 5, placement: 1, joueurs: 60 });
    expect(game.create.mock.calls[0][0].data.result).toBe("V");
  });

  /**
   * Le battle royale avec la boxe en exercice.
   *
   * La partie lue à l'écran d'Apex passe par la même route qu'une saisie à la
   * main, mais elle est la seule qui n'ait ni rôle, ni champion, ni résultat
   * — tout est déduit du classement. La pastille en jeu annonce ensuite ce que
   * la partie coûte, et elle l'annonce dans l'unité de l'exercice choisi :
   * « 30 s de boxe » et « 30 pompes » ne sont pas la même chose. Sans
   * répartition dans la réponse, elle retombe sur le total en points, c'est-à-
   * dire sur un nombre dans la mauvaise unité, sans que rien ne le signale.
   */
  it("rend la répartition en boxe pour une partie lue dans Apex", async () => {
    const r = await post({ jeu: "Apex Legends", kills: 1, placement: 18, joueurs: 60, exercice: "boxe" });
    const { repartition, scoring } = (await corps(r)) as
      { repartition: Record<string, number>; scoring: { pompesFinales: number } };
    expect(Object.keys(repartition)).toEqual(["boxe"]);
    expect(repartition.boxe).toBe(scoring.pompesFinales);
    expect(repartition.boxe).toBeGreaterThan(0);
  });

  it("partage la répartition d'une partie Apex entre les exercices retenus", async () => {
    const r = await post({
      jeu: "Apex Legends", kills: 1, placement: 18, joueurs: 60,
      exercices: ["pompes", "boxe"],
    });
    const { repartition, scoring } = (await corps(r)) as
      { repartition: Record<string, number>; scoring: { pompesFinales: number } };
    expect(Object.keys(repartition).sort()).toEqual(["boxe", "pompes"]);
    expect(repartition.pompes + repartition.boxe).toBe(scoring.pompesFinales);
  });

  it("ajoute au compteur la part de boxe d'une partie Apex", async () => {
    // C'est la dette en attente que la pastille affiche pendant qu'on joue :
    // une partie lue à l'écran doit l'alimenter comme une saisie à la main.
    await post({ jeu: "Apex Legends", kills: 1, placement: 18, joueurs: 60, exercice: "boxe" });
    expect(user.update.mock.calls[0][0].data.dettePointsDus.increment).toBeGreaterThan(0);
  });

  it("fige la ventilation quand plusieurs exercices sont retenus", async () => {
    // L'historique doit rester fidèle même si la sélection change ensuite.
    await post(partie({ exercices: ["pompes", "boxe"] }));
    const data = game.create.mock.calls[0][0].data;
    const parts = JSON.parse(data.repartition);
    expect(Object.keys(parts).sort()).toEqual(["boxe", "pompes"]);
    expect(parts.pompes + parts.boxe).toBe(data.pompesCalculees);
  });

  it("ne stocke aucune ventilation pour un exercice unique", async () => {
    await post(partie({ exercice: "pompes" }));
    expect(game.create.mock.calls[0][0].data.repartition).toBeNull();
  });

  it("n'ajoute au compteur que la part comptée en temps", async () => {
    await post(partie({ exercice: "pompes" }));
    expect(user.update).not.toHaveBeenCalled();
  });

  it("ajoute au compteur la part de boxe", async () => {
    await post(partie({ exercice: "boxe" }));
    expect(user.update.mock.calls[0][0].data.dettePointsDus.increment).toBeGreaterThan(0);
  });

  it("ne prévient qu'au franchissement du seuil", async () => {
    // Le compteur part de zéro et reste sous le seuil : pas de notification.
    user.findUnique.mockResolvedValue({ dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"] });
    user.update.mockResolvedValue({ dettePointsDus: 5 });
    await post(partie({ exercice: "boxe" }));
    expect(notifier).not.toHaveBeenCalled();
  });

  it("prévient une fois le seuil franchi", async () => {
    user.findUnique.mockResolvedValue({ dettePointsDus: 10, rappelSeuilSec: 300, exercices: ["boxe"] });
    user.update.mockResolvedValue({ dettePointsDus: 100 });
    await post(partie({ exercice: "boxe" }));
    expect(notifier).toHaveBeenCalled();
  });

  it("ne prévient pas deux fois pour le même franchissement", async () => {
    // Déjà au-dessus avant l'écriture : le joueur a été prévenu à la partie
    // précédente, le redire à chaque fois ferait couper les notifications.
    user.findUnique.mockResolvedValue({ dettePointsDus: 100, rappelSeuilSec: 300, exercices: ["boxe"] });
    user.update.mockResolvedValue({ dettePointsDus: 140 });
    await post(partie({ exercice: "boxe" }));
    expect(notifier).not.toHaveBeenCalled();
  });

  it("garde la partie même si le compteur échoue", async () => {
    user.update.mockRejectedValue(new Error("base injoignable"));
    const r = await post(partie({ exercice: "boxe" }));
    expect(r.status).toBe(200);
    expect((await corps(r)).dettePointsDus).toBeNull();
  });

  /**
   * La date de début de dette se pose à la base, pas d'après la lecture d'avant.
   *
   * Entre la lecture et l'écriture, un paiement peut éteindre la dette et
   * effacer sa date. On écrivait alors une dette positive SANS date de début,
   * c'est-à-dire une dette qui n'est jamais en retard — `etatRetard` rend
   * « pas en retard » dès que la date manque, quel que soit le montant. Et
   * l'état ne se réparait qu'une fois la dette soldée puis recréée.
   */
  describe("la date de début de dette", () => {
    it("se pose sous condition, à la base", async () => {
      await post(partie({ exercice: "boxe" }));
      const appel = user.updateMany.mock.calls[0][0];
      // La condition est dans le `where` : c'est la base qui tranche, au
      // moment de l'écriture, pas nous d'après une lecture déjà périmée.
      expect(appel.where).toMatchObject({ detteDepuis: null, dettePointsDus: { gt: 0 } });
      expect(appel.data.detteDepuis).toBeInstanceOf(Date);
    });

    it("ne figure pas dans l'écriture qui incrémente", async () => {
      // Posée là, elle serait décidée d'après la lecture d'avant : c'est
      // exactement le défaut qu'on corrige.
      await post(partie({ exercice: "boxe" }));
      expect(user.update.mock.calls[0][0].data).not.toHaveProperty("detteDepuis");
    });

    it("ne coûte pas la notification de seuil quand elle échoue", async () => {
      // Le décompte est déjà écrit : une date qui ne se pose pas ne doit pas
      // faire disparaître ce qui suit.
      user.findUnique.mockResolvedValue({ dettePointsDus: 10, rappelSeuilSec: 300, exercices: ["boxe"] });
      user.update.mockResolvedValue({ dettePointsDus: 100 });
      user.updateMany.mockRejectedValue(new Error("base injoignable"));
      const r = await post(partie({ exercice: "boxe" }));
      expect(r.status).toBe(200);
      expect((await corps(r)).dettePointsDus).toBe(100);
      expect(notifier).toHaveBeenCalled();
    });
  });
});

/**
 * La langue de la notification.
 *
 * Le texte était écrit en dur en français et partait tel quel à tout le
 * monde. Rien ne pouvait le signaler : la personne qui écrit l'application la
 * lit en français, et une notification ne laisse pas de trace à relire.
 */
describe("langue de la notification de seuil", () => {
  const franchirLeSeuil = async (langue: string | null) => {
    user.findUnique.mockResolvedValue({
      dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"], langue,
    });
    user.update.mockResolvedValue({ dettePointsDus: 400 });
    await post(partie({ exercice: "boxe" }));
    return (notifier as jest.Mock).mock.calls[0][1] as { titre: string; corps: string };
  };

  it("suit la langue rangée sur le compte", async () => {
    const ja = await franchirLeSeuil("ja");
    jest.clearAllMocks();
    (prisma.roleWeight.findMany as jest.Mock).mockResolvedValue([
      { role: "MID", poidsKill: 1, poidsMort: 2, poidsAssist: 0.5, maitriseActive: true },
    ]);
    (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue(NIVEAUX);
    (prisma.masteryConfig.findFirst as jest.Mock).mockResolvedValue({ surchargeMax: 0.5, partiesPourMax: 100 });
    game.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "g1", ...data }));
    session.mockResolvedValue(utilisateur({ pompesMax: 20 }));
    bride.mockResolvedValue(false);
    game.findMany.mockResolvedValue([]);
    game.count.mockResolvedValue(0);
    const fr = await franchirLeSeuil("fr");
    expect(ja.titre).not.toBe(fr.titre);
  });

  it("retombe sur l'anglais quand le compte n'en déclare aucune", async () => {
    const sans = await franchirLeSeuil(null);
    // L'anglais et non le français : c'est déjà la règle du navigateur.
    expect(sans.corps).toMatch(/waiting/i);
  });
});

/**
 * L'annotation d'exécution recopiée du compte vers la partie.
 *
 * Elle ne touche à aucun chiffre — et c'est précisément ce qui la rend
 * fragile : rien dans le total ne signalerait qu'on annote des pompes qui
 * n'ont pas eu lieu, ou qu'on a cessé de les annoter.
 */
describe("variante d'exécution", () => {
  it("se recopie sur la partie", async () => {
    session.mockResolvedValue(utilisateur({ pompesMax: 20, variantePompes: "genoux" }));
    await post(partie({ exercice: "pompes" }));
    expect(game.create.mock.calls[0][0].data.variante).toBe("genoux");
  });

  it("tombe quand les pompes ne sont pas de l'effort", async () => {
    session.mockResolvedValue(utilisateur({ pompesMax: 20, variantePompes: "genoux" }));
    await post(partie({ exercice: "boxe" }));
    expect(game.create.mock.calls[0][0].data.variante).toBeNull();
  });

  it("vaut nul quand le compte n'en déclare aucune", async () => {
    await post(partie({ exercice: "pompes" }));
    expect(game.create.mock.calls[0][0].data.variante).toBeNull();
  });

  it("ignore une valeur hors catalogue restée en base", async () => {
    session.mockResolvedValue(utilisateur({ pompesMax: 20, variantePompes: "sur une main" }));
    await post(partie({ exercice: "pompes" }));
    expect(game.create.mock.calls[0][0].data.variante).toBeNull();
  });
});
