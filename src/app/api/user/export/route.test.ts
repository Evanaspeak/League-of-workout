import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findMany: jest.fn() },
    goal: { findUnique: jest.fn() },
    pushSubscription: { findMany: jest.fn() },
    paiement: { findMany: jest.fn() },
    signalement: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({
    passwordHash: "$2a$empreinte-secrete",
    sessionEpoch: 7,
    riotPuuid: "PUUID-SECRET-1234",
    poids: 75, taille: 180, age: 27, genre: "homme",
    createdAt: new Date("2026-06-01"), betaRank: 3,
  }));
  (prisma.game.findMany as jest.Mock).mockResolvedValue([
    { id: "g1", userId: "u1", date: new Date(), pompesCalculees: 38, exercice: "pompes" },
  ]);
  (prisma.goal.findUnique as jest.Mock).mockResolvedValue({ objectifTotalPompes: 1000 });
  (prisma.pushSubscription.findMany as jest.Mock).mockResolvedValue([{ createdAt: new Date() }]);
  (prisma.paiement.findMany as jest.Mock).mockResolvedValue([
    { jour: "2026-08-20", points: 42, createdAt: new Date("2026-08-20T21:00:00Z") },
  ]);
  (prisma.signalement.findMany as jest.Mock).mockResolvedValue([
    { createdAt: new Date("2026-07-01"), message: "le chrono saute", page: "/dashboard", statut: "ouvert" },
  ]);
});

/**
 * L'export sert le droit à la portabilité : il doit être complet. Mais il
 * traverse le réseau et finit dans un fichier sur un disque, donc il ne doit
 * contenir aucun secret. Les deux exigences tirent en sens contraire, et c'est
 * exactement ce que ces tests surveillent.
 */
describe("GET /api/user/export", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("n'exporte que les données du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await GET();
    for (const appel of [
      (prisma.game.findMany as jest.Mock).mock.calls[0][0],
      (prisma.goal.findUnique as jest.Mock).mock.calls[0][0],
      (prisma.pushSubscription.findMany as jest.Mock).mock.calls[0][0],
    ]) {
      expect(JSON.stringify(appel)).toContain("u42");
    }
  });

  it("ne laisse sortir aucun secret", async () => {
    const brut = JSON.stringify(await corps(await GET()));
    for (const secret of ["$2a$empreinte-secrete", "PUUID-SECRET-1234", "sessionEpoch", "passwordHash"]) {
      expect(brut).not.toContain(secret);
    }
  });

  it("inclut les données de santé collectées", async () => {
    // Poids, taille, âge et genre sont collectés à l'inscription. Le droit à
    // la portabilité porte sur eux comme sur le reste.
    const d = await corps(await GET()) as { compte: Record<string, unknown> };
    expect(d.compte.poids).toBe(75);
    expect(d.compte.taille).toBe(180);
    expect(d.compte.age).toBe(27);
    expect(d.compte.genre).toBe("homme");
  });

  it("inclut l'historique des parties", async () => {
    const d = await corps(await GET()) as Record<string, unknown>;
    const brut = JSON.stringify(d);
    expect(brut).toContain("38");
  });

  it("n'expose des abonnements que la date, jamais la clé", async () => {
    // Un abonnement aux notifications porte une clé qui permet d'envoyer un
    // message au navigateur : elle n'a rien à faire dans un fichier exporté.
    await GET();
    const appel = (prisma.pushSubscription.findMany as jest.Mock).mock.calls[0][0];
    expect(Object.keys(appel.select)).toEqual(["createdAt"]);
  });
});

/**
 * Ce que l'export oubliait.
 *
 * Les séances payées manquaient : c'est pourtant la moitié de ce que
 * l'application sait de quelqu'un, et la moitié qu'il a envie de reprendre.
 * Les parties disent ce qu'il a joué, les paiements disent ce qu'il a FAIT.
 */
describe("l'export porte tout ce qui appartient à la personne", () => {
  const lire = async () => corps(await GET());

  it("rend les séances payées, jour par jour", async () => {
    const d = await lire() as { seances: { jour: string; pointsAcquittes: number }[] };
    expect(d.seances).toEqual([
      expect.objectContaining({ jour: "2026-08-20", pointsAcquittes: 42 }),
    ]);
  });

  it("ne lit les séances que du compte courant", async () => {
    await lire();
    expect((prisma.paiement.findMany as jest.Mock).mock.calls[0][0].where.userId)
      .toBe(utilisateur().id);
  });

  it("rend ce que la personne nous a écrit", async () => {
    const d = await lire() as { signalements: { message: string }[] };
    expect(d.signalements[0].message).toBe("le chrono saute");
  });

  it("rend la trace du consentement aux données de santé", async () => {
    // C'est à nous de prouver qu'il a été donné : il est normal que la
    // personne reçoive la même preuve.
    session.mockResolvedValue(utilisateur({ santeConsentiLe: new Date("2026-06-02") }));
    const d = await lire() as { compte: Record<string, unknown> };
    expect(d.compte.santeConsentiLe).toBeTruthy();
  });

  it("ne sort pas le jeton de la source de diffusion", async () => {
    // C'est une donnée du compte, mais c'est aussi un laissez-passer : dans un
    // fichier qu'on s'envoie par courriel, ça devient une clé qui traîne.
    session.mockResolvedValue(utilisateur({ jetonObs: "JETON-OBS-SECRET" }));
    expect(JSON.stringify(await lire())).not.toContain("JETON-OBS-SECRET");
  });
});
