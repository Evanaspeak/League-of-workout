import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: { user: { update: jest.fn(), count: jest.fn() } },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { LONGUEUR_CODE, normaliserCode } from "@/lib/parrainage";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as { user: { update: jest.Mock; count: jest.Mock } };

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi", codeParrain: null }));
  db.user.update.mockImplementation(({ data }: { data: { codeParrain: string } }) =>
    Promise.resolve({ codeParrain: data.codeParrain }));
  db.user.count.mockResolvedValue(0);
});

describe("accès", () => {
  it("refuse sans session, et n'écrit rien", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe("le code", () => {
  it("se tire à la première lecture, dans l'alphabet des codes", async () => {
    const c = await corps(await GET());
    expect(typeof c.code).toBe("string");
    expect(c.code).toHaveLength(LONGUEUR_CODE);
    expect(normaliserCode(c.code as string)).toBe(c.code);
  });

  /**
   * Le tirage n'est pas rejoué à chaque lecture : un lien déjà collé quelque
   * part cesserait de désigner qui que ce soit dès la visite suivante.
   */
  it("ne change plus une fois tiré", async () => {
    session.mockResolvedValue(utilisateur({ id: "moi", codeParrain: "ABCD2345" }));
    const c = await corps(await GET());
    expect(c.code).toBe("ABCD2345");
    expect(db.user.update).not.toHaveBeenCalled();
  });

  /**
   * L'unicité vit en base : deux tirages simultanés ne peuvent pas poser le
   * même code, l'un tombe sur P2002. Sans reprise, l'écran des amis rendrait
   * une erreur serveur pour une raison que personne ne devinerait.
   */
  it("retente sur une collision, et finit par en poser un", async () => {
    let appels = 0;
    db.user.update.mockImplementation(({ data }: { data: { codeParrain: string } }) => {
      appels += 1;
      if (appels < 3) return Promise.reject(Object.assign(new Error("dup"), { code: "P2002" }));
      return Promise.resolve({ codeParrain: data.codeParrain });
    });
    const c = await corps(await GET());
    expect(appels).toBe(3);
    expect(c.code).toHaveLength(LONGUEUR_CODE);
  });

  it("renonce après cinq collisions plutôt que de boucler", async () => {
    db.user.update.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const c = await corps(await GET());
    expect(c.code).toBeNull();
    expect(db.user.update).toHaveBeenCalledTimes(5);
  });

  /** Une panne qui n'est PAS une collision se remonte : la masquer en « pas */
  /*  de code » enverrait chercher un défaut de tirage là où la base est HS. */
  it("laisse remonter une panne qui n'est pas une collision", async () => {
    db.user.update.mockRejectedValue(Object.assign(new Error("hs"), { code: "P1001" }));
    await expect(GET()).rejects.toThrow("hs");
  });
});

describe("les filleuls", () => {
  it("se comptent sur son propre compte, et sur personne d'autre", async () => {
    db.user.count.mockResolvedValue(7);
    const c = await corps(await GET());
    expect(c.filleuls).toBe(7);
    expect(db.user.count.mock.calls[0][0].where).toEqual({ parrainId: "moi" });
  });
});
