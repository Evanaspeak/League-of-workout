/**
 * Le bilan de saison, en image.
 *
 * Le dessin vient de `next/og`, doublé : ce qui s'éprouve ici est ce que la
 * route refuse, ce qu'elle lit, et ce qu'elle met dans l'image.
 *
 * Le contrôle qui compte est celui des parties SANS ENJEU. La même requête
 * est écrite deux fois — ici et dans `/api/bilan` — et une seule des deux
 * filtrait : l'image comptait les parties refusées que la page juste à côté
 * écarte, donc deux chiffres pour la même saison, et c'est l'image qu'on
 * partage. Le journal porte la correction ; rien ne la tenait.
 */
jest.mock("next/og", () => ({
  ImageResponse: class {
    public status = 200;
    constructor(
      public element: unknown,
      public options: unknown,
    ) {}
  },
}));
jest.mock("@/lib/prisma", () => ({
  prisma: { game: { findMany: jest.fn() }, paiement: { findMany: jest.fn() } },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/exercicesConfig", () => ({
  chargerRatios: jest.fn(),
  ratiosPourCompte: jest.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { utilisateur } from "@/test/api";

const session = getCurrentUser as jest.Mock;
const game = prisma.game as unknown as { findMany: jest.Mock };
const paiement = prisma.paiement as unknown as { findMany: jest.Mock };

/** Tous les textes de l'image, à plat. */
const textes = (rendue: unknown) => JSON.stringify((rendue as { element: unknown }).element);

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(
    utilisateur({ id: "moi", pseudo: "Kira", langue: "fr", fuseau: "Europe/Paris" }),
  );
  game.findMany.mockResolvedValue([]);
  paiement.findMany.mockResolvedValue([]);
});

it("refuse sans session, et ne lit rien", async () => {
  session.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(game.findMany).not.toHaveBeenCalled();
  expect(paiement.findMany).not.toHaveBeenCalled();
});

it("ne lit que les données du compte courant", async () => {
  await GET();
  expect(game.findMany.mock.calls[0][0].where.userId).toBe("moi");
  expect(paiement.findMany.mock.calls[0][0].where.userId).toBe("moi");
});

it("écarte les parties sans enjeu, comme la page qu'elle accompagne", async () => {
  // C'est la correction du journal : deux chiffres pour la même saison, et
  // c'est l'image qu'on partage.
  await GET();
  expect(game.findMany.mock.calls[0][0].where.sansEnjeu).toBe(false);
});

it("l'image porte le pseudo du compte", async () => {
  expect(textes(await GET())).toContain("Kira");
});

it("le nombre de parties est celui des parties lues", async () => {
  const partie = (result: "V" | "D") => ({
    date: new Date(),
    result,
    pompesCalculees: 12,
    jeu: "league-of-legends",
    champion: "Ahri",
  });
  game.findMany.mockResolvedValue([partie("V"), partie("D"), partie("D")]);
  const rendu = textes(await GET());
  expect(rendu).toContain('"3"');
  // Et le taux de victoire s'en déduit : une sur trois.
  expect(rendu).toContain("33");
});
