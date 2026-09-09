import { EXERCICE_IDS, RATIOS_DEFAUT } from "@/lib/exercices";
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
jest.mock("@/lib/exercicesConfig", () => ({
  chargerRatios: jest.fn(),
  /*
    Ici la doublure rend un barème COMPLET, et pas `undefined` comme ailleurs :
    c'est celui-là qui est GELÉ sur la partie, donc un jeu vide ferait écrire
    `undefined` dans `Game.ratios` et l'historique perdrait son barème sans que
    rien ne le dise. Les valeurs d'origine conviennent — ce qu'on éprouve est
    le gel, pas le contenu.
  */
  ratiosPourCompte: jest.fn(async () => {
    const reel = jest.requireActual("@/lib/exercices");
    return { ...reel.RATIOS_DEFAUT };
  }),
}));
jest.mock("@/lib/push", () => ({ notifier: jest.fn().mockResolvedValue(undefined) }));

import { GET, POST } from "./route";
import { oublierBareme } from "@/lib/baremeConfig";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { notifier } from "@/lib/push";
import { textesNotification } from "@/lib/i18n/notifications";
import { jourLocal } from "@/lib/serie";
import { PARTIES_A_L_ECRAN } from "@/lib/historiqueBorne";

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
  /**
   * Le barème est mis en cache au niveau du module : une valeur retenue par un
   * cas précédent survivrait au suivant, et le cas « configuration absente »
   * passerait alors sur les paliers d'un autre test. C'est un état partagé, il
   * se réinitialise comme les doublures.
   */
  oublierBareme();
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

const lire = (cible = "/api/games") => GET(requete(cible));

describe("GET /api/games", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await lire()).status).toBe(401);
    expect(game.findMany).not.toHaveBeenCalled();
  });

  it("ne rend que les parties du demandeur", async () => {
    // La seule protection entre comptes est ce filtre : s'il disparaît, la
    // route sert l'historique de tout le monde sans que rien ne change à
    // l'écran de celui qui l'a demandé.
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await lire();
    expect(game.findMany.mock.calls[0][0].where).toEqual({ userId: "u42" });
  });

  it("borne la liste par défaut", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await lire();
    expect(game.findMany.mock.calls[0][0].take).toBe(PARTIES_A_L_ECRAN);
  });

  it("rend tout quand on le demande", async () => {
    // C'est l'archive, et c'est ce que l'écran va chercher dès qu'on filtre :
    // une réponse tronquée ferait dire « trois parties de Valorant » à
    // quelqu'un qui en a deux cents.
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await lire("/api/games?tout=1");
    expect(game.findMany.mock.calls[0][0].take).toBeUndefined();
  });

  it("annonce le total, borné ou non", async () => {
    /*
      Sans lui, l'écran ne peut pas dire qu'il ne montre pas tout — et une
      liste tronquée qui se présente comme l'historique entier est exactement
      le chiffre faux qu'on cherche à éviter. Le compte porte le filtre par
      compte comme la lecture : il dit ce que CETTE personne a joué.
    */
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    game.count.mockResolvedValue(1200);
    game.findMany.mockResolvedValue([{ id: "g1" }]);
    const rep = await lire();
    expect(game.count.mock.calls[0][0].where).toEqual({ userId: "u42" });
    expect(await corps(rep)).toEqual({ parties: [{ id: "g1" }], total: 1200 });
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

  it("ajoute au compteur une partie payée en POMPES", async () => {
    /**
     * L'inverse était vrai jusqu'à V387, et c'est le défaut qui a rendu tout
     * l'étage social vide : la dette ne montait que pour les exercices comptés
     * en temps, donc jamais pour les pompes, donc rien ne passait par le
     * compteur et aucune ligne `Paiement` n'était jamais écrite. Neuf cent
     * soixante parties enregistrées, deux points payés.
     */
    await post(partie({ exercice: "pompes" }));
    expect(user.update.mock.calls[0][0].data.dettePointsDus.increment).toBeGreaterThan(0);
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
    /**
     * Le contrôle porte sur la LANGUE, pas sur la formulation.
     *
     * Il épinglait le mot « waiting », c'est-à-dire UNE des trois
     * formulations que V493 fait tourner par jour. Il est passé au vert
     * jusqu'au 7 septembre et serait devenu rouge à minuit — un test dont la
     * couleur dépend du jour est un test dont on ne connaît pas la couleur,
     * et le journal porte déjà cette leçon pour une branche de parcours prise
     * un jour sur six.
     *
     * On compare donc aux textes ANGLAIS du jour, pris à la source : c'est
     * exactement ce que ce test veut prouver — qu'un compte sans langue
     * déclarée reçoit l'anglais, et non le français.
     */
    const sans = await franchirLeSeuil(null);
    const jour = jourLocal();
    // La durée passée ne compte pas ici : c'est le TITRE qu'on compare, et il
    // n'en dépend pas.
    const en = textesNotification("en", jour).seuil("x");
    const fr = textesNotification("fr", jour).seuil("x");
    expect(sans.titre).toBe(en.titre);
    expect(sans.titre).not.toBe(fr.titre);
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

/**
 * Le barème des exercices, gelé sur la partie.
 *
 * `pompesCalculees` est un coût en POINTS, qui ne dépend d'aucun ratio. Le
 * ratio ne sert qu'à dire ce que ça représente en secondes de boxe ou en
 * squats — et il était lu au moment de l'AFFICHAGE. Changer le prix d'une
 * seconde de boxe dans le panneau d'administration réécrivait donc tout
 * l'historique de tout le monde : une soirée qui avait coûté 4 min 25 en
 * affichait 8 min 50.
 *
 * C'est la même règle que pour `variante` et `exercice` juste au-dessus, et
 * elle avait été appliquée à eux deux sans l'être aux ratios.
 */
describe("le barème en vigueur", () => {
  it("se recopie sur la partie", async () => {
    await post(partie({ exercice: "boxe" }));
    const ecrit = game.create.mock.calls[0][0].data.ratios;
    expect(typeof ecrit).toBe("string");
    expect(JSON.parse(ecrit).boxe).toBe(RATIOS_DEFAUT.boxe);
  });

  it("se recopie aussi sur une séance comptée au temps", async () => {
    // L'autre chemin d'écriture. Il en portait un de moins, et rien ne
    // l'aurait dit : une séance de Minecraft se serait réécrite toute seule.
    await post({ jeu: "Minecraft", dureeSec: 7200, exercice: "boxe" });
    expect(typeof game.create.mock.calls[0][0].data.ratios).toBe("string");
  });

  it("porte tous les exercices, et pas seulement celui qu'on paie", async () => {
    // Une sélection change plus tard ; la partie doit rester lisible sous
    // n'importe quel exercice qu'elle a pu concerner.
    await post(partie({ exercice: "boxe" }));
    const ecrit = JSON.parse(game.create.mock.calls[0][0].data.ratios);
    for (const id of EXERCICE_IDS) expect(typeof ecrit[id]).toBe("number");
  });
});

/**
 * Les parties jouées sans enjeu.
 *
 * Répondre « non » à l'écran de chargement enregistre quand même la partie —
 * on a joué, la trace reste — mais elle ne coûte rien et ne compte nulle part.
 * Trois choses se paient si l'une manque, et chacune a son cas :
 *
 *  - un coût non nul, et l'historique annonce une dette qu'on ne doit pas ;
 *  - une dette alimentée, et le compteur réclame un effort qu'on a refusé ;
 *  - la maîtrise du champion qui monte, et c'est le coût des parties SUIVANTES
 *    qui change — celle-là ne se voit jamais.
 */
describe("une partie sans enjeu", () => {
  /**
   * Le compte paie EN TEMPS, et ce détail décide de tout.
   *
   * `accumulerDette` ne compte que les exercices mesurés en temps ; avec les
   * pompes par défaut, aucune partie n'alimente jamais la dette dans ce
   * fichier. Mon premier contrôle « n'alimente aucune dette » était donc vrai
   * par accident, et le sabotage l'a dit : remettre la dette sur une partie
   * sans enjeu ne le faisait pas tomber. Un test qui passe pour la mauvaise
   * raison ne prouve rien.
   */
  beforeEach(() => {
    session.mockResolvedValue(utilisateur({ id: "u1", exercices: ["boxe"] }));
  });

  it("s'enregistre, mais ne coûte rien", async () => {
    const r = await post(partie({ sansEnjeu: true }));
    expect(r.status).toBe(200);
    const data = game.create.mock.calls[0][0].data;
    expect({ sansEnjeu: data.sansEnjeu, points: data.pompesCalculees })
      .toEqual({ sansEnjeu: true, points: 0 });
  });

  /** Le cas qui compte le plus : elle n'ajoute rien à la dette. */
  it("n'alimente aucune dette", async () => {
    await post(partie({ sansEnjeu: true }));
    expect(user.update).not.toHaveBeenCalled();
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  /**
   * Le témoin de ce contrôle-là, et il est indispensable : sans lui, un compte
   * dont les exercices ne se comptent pas en temps rendrait le test ci-dessus
   * vrai quoi qu'il arrive.
   */
  it("alors qu'une partie ordinaire, elle, l'alimente", async () => {
    await post(partie());
    expect(user.update).toHaveBeenCalled();
  });

  it("ne fait pas monter la maîtrise du champion", async () => {
    await post(partie({ sansEnjeu: true }));
    expect(game.count.mock.calls[0][0].where.sansEnjeu).toBe(false);
  });

  /**
   * Le témoin : sans lui, une route qui n'écrirait plus RIEN passerait les
   * trois contrôles ci-dessus en ne prouvant rien.
   */
  it("et une partie ordinaire coûte toujours son prix", async () => {
    const r = await post(partie());
    expect(r.status).toBe(200);
    const data = game.create.mock.calls[0][0].data;
    expect(data.sansEnjeu).toBe(false);
    expect(data.pompesCalculees).toBeGreaterThan(0);
  });

  /**
   * La RÉPONSE aussi, et c'est le trou que les quatre contrôles ci-dessus
   * laissaient ouvert.
   *
   * Ils regardent ce qui est ÉCRIT et ce que la dette devient. Le champ
   * `repartition` de la réponse, lui, était calculé sur le coût que la partie
   * aurait eu — et c'est LUI que la notification en jeu lit pour dire « X
   * pompes à faire ». On lisait donc « sans enjeu » dans l'historique et une
   * demande de pompes sur le bureau, à la même seconde. Signalé par le
   * propriétaire du produit, et par personne d'autre : rien ne pouvait le
   * voir.
   */
  it("n'annonce aucune quantité dans sa réponse", async () => {
    const r = await post(partie({ sansEnjeu: true }));
    const corps = await r.json();
    const total = Object.values(corps.repartition as Record<string, number>)
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
    expect(corps.dettePointsDus).toBeNull();
  });

  /**
   * Le témoin, sans lequel le contrôle ci-dessus serait vrai d'une route qui
   * ne rendrait plus jamais de quantité à personne.
   */
  it("alors qu'une partie ordinaire en annonce une", async () => {
    const r = await post(partie());
    const corps = await r.json();
    const total = Object.values(corps.repartition as Record<string, number>)
      .reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });

  /**
   * La même règle sur l'autre branche. Elle y était écrite deux fois aussi, et
   * une correction qui n'en répare qu'une moitié est le motif que ce dépôt
   * paie le plus souvent.
   */
  it("vaut aussi pour une séance comptée au temps", async () => {
    const r = await post({ jeu: "Minecraft", typeJeu: "temps", dureeSec: 3600, sansEnjeu: true });
    expect(r.status).toBe(200);
    const corps = await r.json();
    const total = Object.values(corps.repartition as Record<string, number>)
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
    expect(game.create.mock.calls[0][0].data.pompesCalculees).toBe(0);
  });
});

/**
 * La porte d'écriture reçoit trois sources — le formulaire, l'import Riot et
 * la détection locale de l'application Windows — et une seule des trois
 * normalisait le nom du champion. C'est l'asymétrie qui coûte : `Game.champion`
 * est la clé de l'icône de Data Dragon, du regroupement de maîtrise et de ce
 * que l'historique affiche, donc deux orthographes du même champion en base
 * font DEUX champions.
 *
 * Ce qui est mesuré et qui rend le cas concret : Data Dragon porte deux formes
 * de nom, et **vingt et un champions ont une clé différente de leur nom
 * affiché** — « Chogath » contre « Cho'Gath », « MonkeyKing » contre
 * « Wukong ». Aucune de ces vingt et une clés ne figure dans notre liste.
 */
describe("le nom du champion à l'entrée", () => {
  it("se ramène à sa forme canonique", async () => {
    await post(partie({ champion: "Chogath" }));
    expect(game.create.mock.calls[0][0].data.champion).toBe("Cho'Gath");
  });

  it("laisse tel quel un nom déjà canonique", async () => {
    await post(partie({ champion: "Ahri" }));
    expect(game.create.mock.calls[0][0].data.champion).toBe("Ahri");
  });

  /**
   * Le contrôle qui DISTINGUE, et il vaut plus que le premier : la maîtrise se
   * compte sur le nom, et un comptage sur la forme brute regrouperait les
   * parties d'un autre champion que celui qu'on enregistre. Le défaut ne se
   * verrait pas sur la partie qui le crée — il se verrait sur le COÛT des
   * suivantes.
   */
  it("est compté sous cette même forme pour la maîtrise", async () => {
    await post(partie({ champion: "kaisa" }));
    expect(game.count.mock.calls[0][0].where.champion).toBe("Kai'Sa");
    expect(game.create.mock.calls[0][0].data.champion).toBe("Kai'Sa");
  });

  /**
   * Perdre le champion d'une partie qu'on vient de jouer serait pire que de
   * l'écrire de travers : ce qui ne désigne personne est GARDÉ. C'est aussi ce
   * qui rend un champion ajouté par l'administration inoffensif — il ne se
   * ramène à rien, donc il traverse.
   */
  it("garde ce qui ne désigne personne", async () => {
    await post(partie({ champion: "Sylas le Grand" }));
    expect(game.create.mock.calls[0][0].data.champion).toBe("Sylas le Grand");
  });
});
