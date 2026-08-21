jest.mock("@/lib/prisma", () => ({
  prisma: {
    systemConfig: { findUnique: jest.fn() },
    betaApplication: { findUnique: jest.fn() },
  },
}));

import { porteMotDePasse, MESSAGES_PORTE } from "./porteBeta";
import { prisma } from "@/lib/prisma";

const liste = prisma.systemConfig as unknown as { findUnique: jest.Mock };
const candidature = prisma.betaApplication as unknown as { findUnique: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  liste.findUnique.mockResolvedValue(null);
  candidature.findUnique.mockResolvedValue(null);
});

/**
 * Cette règle décidait seule, dans la porte de connexion, alors que le
 * formulaire d'inscription écrivait sans la consulter. On créait donc des
 * comptes que leur propriétaire ne pouvait jamais ouvrir, et le message
 * d'erreur accusait le mot de passe.
 */
describe("porteMotDePasse", () => {
  it("laisse entrer l'administrateur", async () => {
    expect(await porteMotDePasse("evantocquet@gmail.com")).toEqual({ ouverte: true });
  });

  it("laisse entrer une adresse de la liste blanche", async () => {
    liste.findUnique.mockResolvedValue({ value: JSON.stringify(["invite@example.com"]) });
    expect(await porteMotDePasse("invite@example.com")).toEqual({ ouverte: true });
  });

  it("laisse entrer une candidature acceptée", async () => {
    candidature.findUnique.mockResolvedValue({ status: "accepted" });
    expect(await porteMotDePasse("candidat@example.com")).toEqual({ ouverte: true });
  });

  it("distingue le refus, l'attente et l'absence de candidature", async () => {
    candidature.findUnique.mockResolvedValue({ status: "rejected" });
    expect(await porteMotDePasse("a@b.fr")).toEqual({ ouverte: false, raison: "refusee" });

    candidature.findUnique.mockResolvedValue({ status: "pending" });
    expect(await porteMotDePasse("a@b.fr")).toEqual({ ouverte: false, raison: "en-attente" });

    candidature.findUnique.mockResolvedValue(null);
    expect(await porteMotDePasse("a@b.fr")).toEqual({ ouverte: false, raison: "sans-invitation" });
  });

  it("compare l'adresse sans tenir compte de la casse ni des espaces", async () => {
    liste.findUnique.mockResolvedValue({ value: JSON.stringify(["invite@example.com"]) });
    expect(await porteMotDePasse("  INVITE@Example.COM  ")).toEqual({ ouverte: true });
  });

  it("a un message pour chaque refus", () => {
    for (const raison of ["refusee", "en-attente", "sans-invitation"] as const) {
      expect(MESSAGES_PORTE[raison].length).toBeGreaterThan(20);
    }
  });

  it("oriente vers les chemins qui restent ouverts", () => {
    // Google et Discord entrent librement : le refus doit le dire, sinon la
    // personne repart en croyant qu'elle n'a aucun moyen d'entrer.
    expect(MESSAGES_PORTE["sans-invitation"]).toMatch(/Google|Discord/);
  });
});
