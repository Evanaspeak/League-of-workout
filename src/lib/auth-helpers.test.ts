jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: jest.fn() } } }));
jest.mock("@/auth", () => ({ auth: jest.fn() }));

import { getCurrentUser } from "./auth-helpers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const session = auth as unknown as jest.Mock;
const lireCompte = prisma.user.findUnique as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue({ user: { id: "u1", epoch: 3 } });
  lireCompte.mockResolvedValue({ id: "u1", email: "joueur@example.com", sessionEpoch: 3 });
});

describe("getCurrentUser", () => {
  it("rend le compte de la session", async () => {
    await expect(getCurrentUser()).resolves.toMatchObject({ id: "u1" });
  });

  it("ne rend rien sans session", async () => {
    session.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("ne rend rien si le compte a disparu", async () => {
    lireCompte.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("refuse un jeton émis avant une réinitialisation", async () => {
    // Sans cette comparaison, réinitialiser le code d'un compte compromis ne
    // mettait pas l'intrus dehors : son jeton restait valable trente jours.
    session.mockResolvedValue({ user: { id: "u1", epoch: 2 } });
    lireCompte.mockResolvedValue({ id: "u1", sessionEpoch: 3 });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  /**
   * L'empreinte du mot de passe ne doit pas sortir de la base.
   *
   * Cet objet circule dans une cinquantaine de routes ; il suffit qu'une seule
   * le rende tel quel. Deux routes le retiraient à la main, chacune de son
   * côté — une garantie qui vit à trois endroits n'en est pas une. Ce test
   * vérifie qu'elle vit à un seul : la lecture elle-même.
   */
  it("ne demande jamais l'empreinte du mot de passe à la base", async () => {
    await getCurrentUser();
    const requete = lireCompte.mock.calls[0][0];
    expect(requete.omit).toMatchObject({ passwordHash: true });
  });
});
