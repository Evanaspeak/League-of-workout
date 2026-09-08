/**
 * L'adresse portée par une notification.
 *
 * Elle pointait sur `/dashboard`, sans langue. Le site rattrape alors
 * l'adresse et la renvoie vers la langue NÉGOCIÉE par le navigateur qui ouvre
 * le lien — or la notification, elle, est déjà écrite dans la langue du
 * compte. On annonçait donc une chose en japonais pour ouvrir un écran en
 * anglais.
 *
 * Les clés VAPID sont posées AVANT l'import : `web-push` est configuré au
 * premier envoi, et sans elles `notifier` rend la main sans rien faire — tous
 * les tests passeraient en ne mesurant rien. C'est le piège déjà rencontré sur
 * les courriels, où la clé Resend se lit au chargement du module.
 */
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "cle-publique-de-test";
process.env.VAPID_PRIVATE_KEY = "cle-privee-de-test";

jest.mock("web-push", () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn().mockResolvedValue({}) },
}));
jest.mock("./prisma", () => ({
  prisma: {
    pushSubscription: { findMany: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn() },
    envoiPush: { count: jest.fn(), create: jest.fn() },
  },
}));

import webpush from "web-push";
import { notifier, NOTIFS_PAR_SEMAINE_MAX, RESERVE_RANG_UN } from "./push";
import { prisma } from "./prisma";

const envoi = (webpush as unknown as { sendNotification: jest.Mock }).sendNotification;
const abos = prisma.pushSubscription as unknown as { findMany: jest.Mock; delete: jest.Mock };
const user = prisma.user as unknown as { findUnique: jest.Mock };
const envois = prisma.envoiPush as unknown as { count: jest.Mock; create: jest.Mock };

const ABO = {
  endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a",
};

beforeEach(() => {
  jest.clearAllMocks();
  abos.findMany.mockResolvedValue([ABO]);
  envoi.mockResolvedValue({});
  user.findUnique.mockResolvedValue({ langue: "fr" });
  envois.count.mockResolvedValue(0);
  envois.create.mockResolvedValue({});
});

/** Ce que le navigateur reçoit, décodé. */
const charge = () => JSON.parse(envoi.mock.calls[0][1] as string);

describe("l'adresse d'une notification", () => {
  it("porte la langue du compte", async () => {
    user.findUnique.mockResolvedValue({ langue: "ja" });
    await notifier("u1", { titre: "t", corps: "c" });
    expect(charge().url).toBe("/ja/dashboard");
  });

  it("respecte une adresse donnée par l'appelant", async () => {
    await notifier("u1", { titre: "t", corps: "c", url: "/fr/history" });
    expect(charge().url).toBe("/fr/history");
  });

  it("retombe sur l'anglais quand le compte n'a pas de langue", async () => {
    // Jamais sur le français : c'est la langue de celui qui écrit
    // l'application, et il ne verrait donc jamais le défaut.
    user.findUnique.mockResolvedValue({ langue: null });
    await notifier("u1", { titre: "t", corps: "c" });
    expect(charge().url).toBe("/en/dashboard");
  });

  it("envoie quand même si la lecture du compte échoue", async () => {
    // Une notification perdue parce qu'une colonne n'a pas pu être lue serait
    // un mauvais échange : le contenu, lui, est déjà composé.
    user.findUnique.mockRejectedValue(new Error("base indisponible"));
    expect(await notifier("u1", { titre: "t", corps: "c" })).toBe(1);
    expect(charge().url).toBe("/en/dashboard");
  });

  it("ne lit rien quand il n'y a personne à prévenir", async () => {
    abos.findMany.mockResolvedValue([]);
    expect(await notifier("u1", { titre: "t", corps: "c" })).toBe(0);
    expect(user.findUnique).not.toHaveBeenCalled();
  });
});

/**
 * Trois par semaine au maximum — réponse 103.
 *
 * Le plafond protège le CANAL et non la personne : une application qui
 * insiste se fait couper, et on coupe tout en même temps, y compris le rappel
 * qui servait. C'est le raisonnement de la relance des absents, envoyée une
 * fois et une seule, appliqué à l'ensemble des envois.
 */
describe("le plafond hebdomadaire", () => {
  it("laisse passer tant qu'on est en dessous", async () => {
    envois.count.mockResolvedValue(NOTIFS_PAR_SEMAINE_MAX - 1 - RESERVE_RANG_UN);
    expect(await notifier("u1", { titre: "t", corps: "c" })).toBe(1);
    expect(envoi).toHaveBeenCalled();
  });

  it("refuse au-delà, sans rien envoyer", async () => {
    envois.count.mockResolvedValue(NOTIFS_PAR_SEMAINE_MAX);
    expect(await notifier("u1", { titre: "t", corps: "c" }, { rang: 1 })).toBe(0);
    expect(envoi).not.toHaveBeenCalled();
  });

  /**
   * La réserve, et le seul jeu de données qui la montre.
   *
   * À `MAX - RESERVE` envois déjà partis, le budget du rang 2 est atteint et
   * celui du rang 1 ne l'est pas : c'est exactement l'état où le rappel du
   * matin cède la place au seuil. Un compte à zéro envoi ou à `MAX` rendrait
   * le même résultat pour les deux rangs, donc ne prouverait rien.
   */
  it("garde la dernière place pour le rang 1", async () => {
    envois.count.mockResolvedValue(NOTIFS_PAR_SEMAINE_MAX - RESERVE_RANG_UN);

    // Le rang 2 — rappel du matin, rappel de pesée — cède.
    expect(await notifier("u1", { titre: "t", corps: "c" }, { rang: 2 })).toBe(0);
    // Et il cède AUSSI quand personne ne l'a déclaré : le défaut est le plus
    // prudent, sinon un appelant ajouté demain reprendrait la place.
    expect(await notifier("u1", { titre: "t", corps: "c" })).toBe(0);
    expect(envoi).not.toHaveBeenCalled();

    // Le seuil passe.
    expect(await notifier("u1", { titre: "t", corps: "c" }, { rang: 1 })).toBe(1);
    expect(envoi).toHaveBeenCalled();
  });

  it("compte sur une fenêtre GLISSANTE de sept jours", async () => {
    // Une semaine calendaire laisserait passer trois envois le dimanche et
    // trois le lundi, soit six en deux jours — exactement ce qu'on évite.
    await notifier("u1", { titre: "t", corps: "c" });
    const ou = envois.count.mock.calls[0][0].where;
    expect(ou.userId).toBe("u1");
    const ecart = Date.now() - (ou.quand.gte as Date).getTime();
    expect(Math.round(ecart / 3600_000)).toBe(7 * 24);
  });

  it("retient l'envoi, avec ce qu'il était", async () => {
    await notifier("u1", { titre: "t", corps: "c", tag: "wow-matin" });
    expect(envois.create).toHaveBeenCalledWith({ data: { userId: "u1", tag: "wow-matin" } });
  });

  it("ne consomme rien quand l'envoi n'est parti nulle part", async () => {
    // Un service injoignable ou des abonnements tous révoqués n'ont dérangé
    // personne : décompter ferait perdre le rappel suivant à cause d'une
    // panne dont la personne n'a rien su.
    envoi.mockRejectedValue(Object.assign(new Error("hs"), { statusCode: 500 }));
    expect(await notifier("u1", { titre: "t", corps: "c" })).toBe(0);
    expect(envois.create).not.toHaveBeenCalled();
  });

  it("n'échoue pas quand la trace ne peut pas s'écrire", async () => {
    // Elle passe en dernier, comme le badge du paiement éclair : son échec ne
    // coûte que lui-même, là où une notification perdue se voit.
    envois.create.mockRejectedValue(new Error("base indisponible"));
    expect(await notifier("u1", { titre: "t", corps: "c" })).toBe(1);
  });

  it("est le DÉFAUT, et l'exemption se demande", async () => {
    // Dans l'autre sens, un appelant ajouté demain enverrait sans compter, et
    // rien ne le dirait : le défaut ne peut pas être plus permissif que ce
    // qu'on demandait.
    envois.count.mockResolvedValue(99);
    expect(await notifier("u1", { titre: "t", corps: "c" })).toBe(0);
    expect(await notifier("u1", { titre: "t", corps: "c" }, {})).toBe(0);
    expect(await notifier("u1", { titre: "t", corps: "c" }, { plafonne: true })).toBe(0);
    expect(await notifier("u1", { titre: "t", corps: "c" }, { plafonne: false })).toBe(1);
  });

  it("ne retient pas ce qui est dispensé", async () => {
    // La notification d'essai ne compte pas contre le plafond : elle n'est pas
    // une sollicitation du produit, c'est une réponse à un bouton.
    await notifier("u1", { titre: "t", corps: "c" }, { plafonne: false });
    expect(envois.create).not.toHaveBeenCalled();
    expect(envois.count).not.toHaveBeenCalled();
  });
});
