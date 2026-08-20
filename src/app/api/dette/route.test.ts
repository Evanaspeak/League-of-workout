import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { user: { update: jest.fn() } } }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn() }));

import { GET, PATCH, PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { appliquerRatios, RATIOS_DEFAUT } from "@/lib/exercices";

const session = getCurrentUser as jest.Mock;
const user = prisma.user as unknown as { update: jest.Mock };

const joueur = (champs: Record<string, unknown> = {}) =>
  utilisateur({ exercices: ["boxe"], dettePointsDus: 100, rappelSeuilSec: 300, ...champs });

beforeEach(() => {
  jest.clearAllMocks();
  appliquerRatios(RATIOS_DEFAUT);
  session.mockResolvedValue(joueur());
  user.update.mockImplementation(async ({ data }: { data: { dettePointsDus: number } }) => ({
    dettePointsDus: data.dettePointsDus, rappelSeuilSec: 300, exercices: ["boxe"],
  }));
});

/**
 * Le compteur en attente est la seule donnée que l'application modifie sans
 * qu'un écran ne la montre écrite : elle monte à chaque partie, descend quand
 * on paie. Une erreur de conversion s'y voit tard, et sous forme d'un chiffre
 * qui a l'air plausible.
 */
describe("GET /api/dette", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("exprime la dette en temps d'effort", async () => {
    const d = await corps(await GET());
    expect(d.points).toBe(100);
    expect(d.dureeSec).toBe(700); // 100 points × 7 s de boxe
  });

  it("ne retient que les exercices comptés en temps", async () => {
    // Les pompes se font dans la foulée : elles n'ont rien à faire dans un
    // compteur d'attente, sinon la dette resterait due deux fois.
    session.mockResolvedValue(joueur({ exercices: ["pompes", "boxe"] }));
    const d = await corps(await GET()) as { exercices: string[] };
    expect(d.exercices).toEqual(["boxe"]);
  });

  it("suit les ratios en vigueur", async () => {
    appliquerRatios({ boxe: 14 });
    expect((await corps(await GET())).dureeSec).toBe(1400);
  });
});

describe("PATCH /api/dette", () => {
  const patch = (body: unknown) => PATCH(requete("/api/dette", { method: "PATCH", body }));

  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await patch({ tout: true })).status).toBe(401);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("remet le compteur à zéro quand tout est fait", async () => {
    await patch({ tout: true });
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(0);
  });

  it("ne paie que le temps réellement effectué", async () => {
    // 100 points de boxe valent 700 s ; 350 s effectuées en paient la moitié.
    await patch({ secondes: 350 });
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(50);
  });

  it("solde la dette quand le temps effectué la dépasse", async () => {
    await patch({ secondes: 99999 });
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(0);
  });

  it("ne crédite rien pour un temps nul ou absurde", async () => {
    await patch({ secondes: -500 });
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(100);
  });

  it("n'écrit que sur le compte du demandeur", async () => {
    session.mockResolvedValue(joueur({ id: "u42" }));
    await patch({ tout: true });
    expect(user.update.mock.calls[0][0].where).toEqual({ id: "u42" });
  });

  it("survit à un corps illisible", async () => {
    const r = await PATCH(new Request("http://localhost/api/dette", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{cassé",
    }));
    expect(r.status).toBe(200);
  });
});

describe("PUT /api/dette", () => {
  const put = (body: unknown) => PUT(requete("/api/dette", { method: "PUT", body }));

  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await put({ secondes: 60 })).status).toBe(401);
  });

  it("convertit la durée demandée en points", async () => {
    await put({ secondes: 700 });
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(100);
  });

  it("refuse une durée hors bornes", async () => {
    // NaN n'existe pas en JSON — il arriverait en `null`, donc en zéro, qui
    // est une valeur légitime. Les cas réellement refusables sont ceux-ci.
    for (const secondes of [-1, 7201, 100000, "beaucoup"]) {
      expect((await put({ secondes })).status).toBe(400);
    }
    expect(user.update).not.toHaveBeenCalled();
  });

  it("accepte zéro, qui vide le compteur", async () => {
    const r = await put({ secondes: 0 });
    expect(r.status).toBe(200);
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(0);
  });

  it("refuse quand aucun exercice ne se compte au temps", async () => {
    session.mockResolvedValue(joueur({ exercices: ["pompes"] }));
    const r = await put({ secondes: 300 });
    expect(r.status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
  });
});
