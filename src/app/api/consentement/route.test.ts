import { requete, requeteCassee, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { user: { update: jest.fn() } } }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, POST, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const update = (prisma as unknown as { user: { update: jest.Mock } }).user.update;

const poster = (body: unknown) =>
  POST(requete("/api/consentement", { method: "POST", body }));

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ santeConsentiLe: null, santeRefuseLe: null }));
  update.mockResolvedValue({});
});

describe("sans session", () => {
  it("refuse les trois verbes", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await poster({ accepte: true })).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("état du consentement", () => {
  it("distingue les trois états", async () => {
    expect((await corps(await GET())).etat).toBe("jamais");

    session.mockResolvedValue(utilisateur({ santeConsentiLe: new Date(), santeRefuseLe: null }));
    expect((await corps(await GET())).etat).toBe("accepte");

    session.mockResolvedValue(utilisateur({ santeConsentiLe: null, santeRefuseLe: new Date() }));
    expect((await corps(await GET())).etat).toBe("refuse");
  });

  it("dit si le compte détient déjà des données de santé", async () => {
    expect((await corps(await GET())).aDesDonnees).toBe(false);
    session.mockResolvedValue(utilisateur({ poids: 78, santeConsentiLe: null, santeRefuseLe: null }));
    expect((await corps(await GET())).aDesDonnees).toBe(true);
  });
});

describe("réponse", () => {
  it("accepter pose la date et ne touche pas aux données", async () => {
    const r = await poster({ accepte: true });
    expect(r.status).toBe(200);
    const data = update.mock.calls[0][0].data;
    expect(data.santeConsentiLe).toBeInstanceOf(Date);
    expect(data.santeRefuseLe).toBeNull();
    expect(data).not.toHaveProperty("poids");
  });

  it("refuser efface vraiment les cinq champs", async () => {
    // Conserver les données en s'abstenant de les afficher ne serait pas un
    // retrait de consentement : la conservation est déjà un traitement.
    await poster({ accepte: false });
    const data = update.mock.calls[0][0].data;
    expect(data.santeRefuseLe).toBeInstanceOf(Date);
    expect(data.santeConsentiLe).toBeNull();
    for (const champ of ["genre", "age", "poids", "taille", "sportsHoursPerWeek"]) {
      expect(data[champ]).toBeNull();
    }
  });

  it("le retrait fait la même chose que le refus", async () => {
    await DELETE();
    const data = update.mock.calls[0][0].data;
    expect(data.santeConsentiLe).toBeNull();
    expect(data.poids).toBeNull();
  });

  it("n'écrit rien sur une réponse absente, ambiguë ou illisible", async () => {
    for (const body of [{}, { accepte: "oui" }, { accepte: 1 }, null]) {
      expect((await poster(body)).status).toBe(400);
    }
    expect((await POST(requeteCassee("/api/consentement"))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("écrit sur le compte de la session, jamais sur un autre", async () => {
    await poster({ accepte: true });
    expect(update.mock.calls[0][0].where).toEqual({ id: "u1" });
  });
});
