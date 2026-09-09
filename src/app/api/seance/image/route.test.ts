/**
 * L'image de la dernière séance.
 *
 * Ce qui s'éprouve ici n'est pas le dessin — il vient de `next/og`, doublé —
 * mais ce que la route REFUSE, et ce qu'elle met dans l'image. Les deux
 * comptent : une image se partage, donc un chiffre faux y voyage plus loin
 * qu'ailleurs, et une image vide se partagerait sans qu'on sache qu'elle ne
 * dit rien.
 *
 * Le contrôle du chiffre est le seul qui distingue vraiment : c'est la
 * décision écrite en tête de la route — « le chiffre vient de la BASE », pas
 * de l'adresse — et rien ne la tenait.
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
  prisma: { paiement: { findMany: jest.fn() } },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { utilisateur } from "@/test/api";
import { jourLocal } from "@/lib/serie";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as { paiement: { findMany: jest.Mock } };

const jourIlYA = (n: number) => jourLocal(new Date(Date.now() - n * 86_400_000));
const p = (id: string, points: number, jours: number) => ({
  id,
  points,
  jour: jourIlYA(jours),
});

/** Tous les textes de l'image, à plat : c'est là que le chiffre s'affiche. */
function textes(rendue: unknown): string {
  return JSON.stringify((rendue as { element: unknown }).element);
}

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi", langue: "fr" }));
});

it("refuse sans session, et ne lit rien", async () => {
  session.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(db.paiement.findMany).not.toHaveBeenCalled();
});

it("filtre les paiements sur le compte", async () => {
  db.paiement.findMany.mockResolvedValue([]);
  await GET();
  expect(db.paiement.findMany.mock.calls[0][0].where).toEqual({ userId: "moi" });
});

it("sans aucune séance, il n'y a pas d'image", async () => {
  // Une image vide se partagerait sans qu'on sache qu'elle ne dit rien.
  db.paiement.findMany.mockResolvedValue([]);
  const rendue = await GET();
  expect(rendue.status).toBe(404);
});

it("le chiffre de l'image est celui de la DERNIÈRE séance", async () => {
  // La lecture est triée par date de création décroissante : c'est la
  // première ligne qui compte, pas la plus grosse. Les deux nombres sont
  // éloignés exprès — une image qui montrerait le record au lieu de la
  // séance du jour serait fausse sans qu'on puisse le voir.
  db.paiement.findMany.mockResolvedValue([p("a", 137, 0), p("b", 900, 3)]);
  expect(textes(await GET())).toContain("137");
  expect(textes(await GET())).not.toContain("900");
});

it("le chiffre est mis en forme dans la langue du compte", async () => {
  // 1 234 s'écrit « 1 234 » en français et « 1,234 » en anglais. Un nombre nu
  // dans une image partagée est le défaut que ce projet corrige en boucle.
  db.paiement.findMany.mockResolvedValue([p("a", 1234, 0)]);
  const fr = textes(await GET());
  session.mockResolvedValue(utilisateur({ id: "moi", langue: "en" }));
  const en = textes(await GET());
  expect(fr).not.toContain("1234");
  expect(en).not.toContain("1234");
  expect(fr).not.toBe(en);
});
