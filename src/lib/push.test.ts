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
  },
}));

import webpush from "web-push";
import { notifier } from "./push";
import { prisma } from "./prisma";

const envoi = (webpush as unknown as { sendNotification: jest.Mock }).sendNotification;
const abos = prisma.pushSubscription as unknown as { findMany: jest.Mock; delete: jest.Mock };
const user = prisma.user as unknown as { findUnique: jest.Mock };

const ABO = {
  endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a",
};

beforeEach(() => {
  jest.clearAllMocks();
  abos.findMany.mockResolvedValue([ABO]);
  envoi.mockResolvedValue({});
  user.findUnique.mockResolvedValue({ langue: "fr" });
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
