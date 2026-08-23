import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { user: { update: jest.fn() } } }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, POST, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const update = (prisma as unknown as { user: { update: jest.Mock } }).user.update;

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ jetonObs: null }));
  update.mockResolvedValue({});
});

describe("accès", () => {
  it("refuse les trois verbes sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST()).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("le lien", () => {
  it("n'existe pas tant qu'on ne l'a pas demandé", async () => {
    // Une adresse publique qui montre quelque chose de vous ne doit pas
    // exister par défaut.
    expect((await corps(await GET())).jeton).toBeNull();
  });

  it("est assez long pour ne pas se deviner", async () => {
    const { jeton } = await corps(await POST()) as { jeton: string };
    expect(jeton.length).toBeGreaterThanOrEqual(40);
    expect(jeton).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("diffère à chaque demande", async () => {
    const a = (await corps(await POST())).jeton;
    const b = (await corps(await POST())).jeton;
    expect(a).not.toBe(b);
  });

  it("s'écrit sur le compte de la session, jamais sur un autre", async () => {
    session.mockResolvedValue(utilisateur({ id: "u5" }));
    await POST();
    expect(update.mock.calls[0][0].where).toEqual({ id: "u5" });
  });

  it("se retire vraiment, et pas seulement de l'affichage", async () => {
    await DELETE();
    expect(update.mock.calls[0][0].data).toEqual({ jetonObs: null });
  });
});
