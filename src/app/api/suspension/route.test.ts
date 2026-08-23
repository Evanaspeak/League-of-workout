import { requete, requeteCassee, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { user: { update: jest.fn() } } }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET, POST, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const update = (prisma as unknown as { user: { update: jest.Mock } }).user.update;

const suspendre = (exercice: unknown) =>
  POST(requete("/api/suspension", { method: "POST", body: { exercice } }));
const reprendre = (exercice: unknown) =>
  DELETE(requete("/api/suspension", { method: "DELETE", body: { exercice } }));

const joueur = (champs: Record<string, unknown> = {}) =>
  utilisateur({ exercices: ["pompes", "squats", "boxe"], exercicesSuspendus: [], ...champs });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(joueur());
  update.mockResolvedValue({});
});

describe("accès", () => {
  it("refuse les trois verbes sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await suspendre("pompes")).status).toBe(401);
    expect((await reprendre("pompes")).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("suspendre", () => {
  it("sort l'exercice de la liste active", async () => {
    // Tout ce qui répartit la dette lit cette liste : la dette part donc vers
    // les autres exercices sans qu'aucune de ces lectures ait à changer.
    const r = await corps(await suspendre("pompes"));
    expect(r.actifs).toEqual(["squats", "boxe"]);
    expect(r.suspendus).toEqual(["pompes"]);
    expect(update.mock.calls[0][0].data.exercices).toEqual(["squats", "boxe"]);
  });

  it("refuse de suspendre le dernier", async () => {
    // Sans lui, la dette n'aurait plus aucune façon d'être payée : elle
    // s'accumulerait sans issue.
    session.mockResolvedValue(joueur({ exercices: ["pompes"] }));
    const r = await suspendre("pompes");
    expect(r.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("pose la date à la première suspension et la garde à la seconde", async () => {
    const debut = new Date("2026-08-20T10:00:00Z");
    session.mockResolvedValue(joueur({ exercicesSuspendus: ["boxe"], suspensionDepuis: debut }));
    await suspendre("pompes");
    expect(update.mock.calls[0][0].data.suspensionDepuis).toBe(debut);
  });

  it("ne suspend pas deux fois le même", async () => {
    session.mockResolvedValue(joueur({ exercices: ["pompes", "squats"], exercicesSuspendus: ["boxe"] }));
    const r = await corps(await suspendre("pompes"));
    expect(r.suspendus).toEqual(["boxe", "pompes"]);
  });

  it("refuse un exercice inconnu, absent des actifs, ou un corps illisible", async () => {
    expect((await suspendre("trampoline")).status).toBe(400);
    session.mockResolvedValue(joueur({ exercices: ["squats"], exercicesSuspendus: ["pompes"] }));
    expect((await suspendre("pompes")).status).toBe(400);
    expect((await POST(requeteCassee("/api/suspension"))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("reprendre", () => {
  it("remet l'exercice dans la liste active", async () => {
    session.mockResolvedValue(joueur({ exercices: ["squats"], exercicesSuspendus: ["pompes"] }));
    const r = await corps(await reprendre("pompes"));
    expect(r.actifs).toEqual(["pompes", "squats"]);
    expect(r.suspendus).toEqual([]);
  });

  it("efface la date quand plus rien n'est suspendu", async () => {
    session.mockResolvedValue(joueur({
      exercices: ["squats"], exercicesSuspendus: ["pompes"], suspensionDepuis: new Date(),
    }));
    await reprendre("pompes");
    expect(update.mock.calls[0][0].data.suspensionDepuis).toBeNull();
  });

  it("garde la date tant qu'il en reste un", async () => {
    const debut = new Date("2026-08-20T10:00:00Z");
    session.mockResolvedValue(joueur({
      exercices: ["squats"], exercicesSuspendus: ["pompes", "boxe"], suspensionDepuis: debut,
    }));
    await reprendre("pompes");
    expect(update.mock.calls[0][0].data.suspensionDepuis).toBe(debut);
  });
});

describe("lecture", () => {
  it("rend les deux listes et la date", async () => {
    const debut = new Date("2026-08-20T10:00:00Z");
    session.mockResolvedValue(joueur({
      exercices: ["squats"], exercicesSuspendus: ["pompes"], suspensionDepuis: debut,
    }));
    const r = await corps(await GET());
    expect(r.actifs).toEqual(["squats"]);
    expect(r.suspendus).toEqual(["pompes"]);
    expect(r.depuis).toBeTruthy();
  });

  it("ignore un exercice suspendu qui n'existe plus au catalogue", async () => {
    // Un identifiant retiré du catalogue ne doit pas apparaître comme un
    // exercice reprenable qui n'existe pas.
    session.mockResolvedValue(joueur({ exercicesSuspendus: ["trampoline"] }));
    expect((await corps(await GET())).suspendus).toEqual([]);
  });
});
