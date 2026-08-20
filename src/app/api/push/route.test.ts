import { requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn(),
    },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ isRateLimited: jest.fn(), recordAttempt: jest.fn() }));
// Les clés VAPID vivent dans l'environnement : sans elles la route répond 503
// avant toute validation. On la déclare configurée, et on garde le vrai
// contrôle d'adresse, qui est justement ce qu'on veut éprouver.
jest.mock("@/lib/push", () => ({
  ...jest.requireActual("@/lib/push"),
  pushConfigure: () => true,
  notifier: jest.fn().mockResolvedValue(1),
}));

import { GET, POST, DELETE, PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isRateLimited } from "@/lib/rate-limit";
import { ABONNEMENTS_MAX } from "@/lib/push";

const session = getCurrentUser as jest.Mock;
const bride = isRateLimited as jest.Mock;
const abo = prisma.pushSubscription as unknown as Record<string, jest.Mock>;

/** Une adresse d'abonnement telle qu'un vrai navigateur en produit. */
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abcdef123456";
const CORPS = { endpoint: ENDPOINT, keys: { p256dh: "cle-publique", auth: "secret-auth" } };

const post = (body: unknown) => POST(requete("/api/push", { method: "POST", body }));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur());
  bride.mockResolvedValue(false);
  abo.findUnique.mockResolvedValue(null);
  abo.findMany.mockResolvedValue([]);
  abo.upsert.mockResolvedValue({});
  abo.deleteMany.mockResolvedValue({ count: 0 });
});

/**
 * Un abonnement porte une clé qui permet d'envoyer une notification à un
 * navigateur précis. Se l'attribuer, c'est priver quelqu'un de ses rappels et
 * pouvoir lui écrire à sa place.
 */
describe("/api/push", () => {
  it("refuse chaque verbe sans session", async () => {
    session.mockResolvedValue(null);
    for (const appel of [GET(), post(CORPS), DELETE(requete("/api/push", { method: "DELETE" })), PUT()]) {
      expect((await appel).status).toBe(401);
    }
    expect(abo.upsert).not.toHaveBeenCalled();
    expect(abo.deleteMany).not.toHaveBeenCalled();
  });

  it("refuse un abonnement incomplet", async () => {
    for (const body of [{}, { endpoint: ENDPOINT }, { endpoint: ENDPOINT, keys: {} }, { keys: CORPS.keys }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(abo.upsert).not.toHaveBeenCalled();
  });

  it("refuse une adresse qui ne vient pas d'un service de notification", async () => {
    // Sans ce filtre, la route devient un émetteur de requêtes vers n'importe
    // quelle adresse choisie par celui qui s'abonne.
    for (const endpoint of ["http://192.168.1.1/admin", "https://exemple.invalide/x", "pas-une-url"]) {
      expect((await post({ ...CORPS, endpoint })).status).toBe(400);
    }
    expect(abo.upsert).not.toHaveBeenCalled();
  });

  it("refuse de s'approprier l'abonnement d'un autre compte", async () => {
    // La clause portait sur la seule adresse : connaître celle d'un autre
    // suffisait à se l'attribuer et à le priver de ses rappels.
    abo.findUnique.mockResolvedValue({ userId: "quelqu-un-d-autre" });
    expect((await post(CORPS)).status).toBe(409);
    expect(abo.upsert).not.toHaveBeenCalled();
  });

  it("laisse un navigateur se réabonner sans empiler", async () => {
    abo.findUnique.mockResolvedValue({ userId: "u1" });
    expect((await post(CORPS)).status).toBe(200);
    expect(abo.upsert.mock.calls[0][0].where).toEqual({ endpoint: ENDPOINT });
  });

  it("écarte les abonnements au-delà du plafond, du plus ancien", async () => {
    abo.findMany.mockResolvedValue([{ id: "vieux1" }, { id: "vieux2" }]);
    await post(CORPS);
    expect(abo.findMany.mock.calls[0][0].skip).toBe(ABONNEMENTS_MAX);
    expect(abo.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["vieux1", "vieux2"] } } });
  });

  it("ne supprime que les abonnements du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await DELETE(requete("/api/push", { method: "DELETE", body: { endpoint: ENDPOINT } }));
    expect(abo.deleteMany.mock.calls[0][0].where).toEqual({ userId: "u42", endpoint: ENDPOINT });
  });

  it("supprime tous les appareils quand aucun n'est précisé", async () => {
    await DELETE(requete("/api/push", { method: "DELETE" }));
    expect(abo.deleteMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });

  it("borne l'envoi de test au compte, pas à l'adresse réseau", async () => {
    // C'est le compte qui reçoit la notification : c'est donc lui qu'il faut
    // compter, sinon on peut se harceler soi-même depuis plusieurs réseaux.
    bride.mockResolvedValue(true);
    const r = await PUT();
    expect(r.status).toBe(429);
    expect(bride.mock.calls[0][0]).toContain("u1");
  });
});
