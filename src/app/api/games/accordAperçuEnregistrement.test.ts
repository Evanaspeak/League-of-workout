/**
 * L'aperçu doit annoncer le chiffre que l'enregistrement écrira.
 *
 * C'est la promesse du commentaire en tête des deux routes, et elle avait été
 * rompue en silence : depuis que le niveau se lit sur le test de pompes,
 * l'enregistrement passait au barème le seuil du niveau retenu tandis que
 * l'aperçu lui passait encore le gainage brut. Les deux nombres divergeaient
 * dès que les deux niveaux ne coïncidaient plus.
 *
 * Personne ne l'a vu parce que le formulaire de saisie envoie un gainage, ce
 * qui masquait l'écart. L'overlay, lui, n'en envoie pas : il annonçait quatre
 * pompes là où dix étaient dues.
 *
 * Ce test appelle les deux routes avec le même corps et compare ce qu'elles
 * rendent. Il ne connaît pas la formule — c'est justement ce qui le rend utile.
 */
import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    roleWeight: { findMany: jest.fn() },
    levelConfig: { findMany: jest.fn() },
    masteryConfig: { findFirst: jest.fn() },
    game: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    user: { update: jest.fn(), findUnique: jest.fn() },
    goal: { findUnique: jest.fn() },
    loginAttempt: { deleteMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  },
}));
jest.mock("@/lib/seed-defaults", () => ({ seedDefaults: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn().mockResolvedValue({}) }));

import { POST as apercu } from "./preview/route";
import { POST as enregistrer } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const p = prisma as unknown as Record<string, Record<string, jest.Mock>>;

/** Cinq niveaux, comme en base : plus le test de force est haut, plus ça coûte. */
const NIVEAUX = [
  { niveau: 1, seuilGainageSec: 0, seuilPompes: 0, multiplicateur: 0.6, malusDefaite: 2 },
  { niveau: 2, seuilGainageSec: 30, seuilPompes: 10, multiplicateur: 0.8, malusDefaite: 4 },
  { niveau: 3, seuilGainageSec: 60, seuilPompes: 20, multiplicateur: 1.0, malusDefaite: 6 },
  { niveau: 4, seuilGainageSec: 120, seuilPompes: 35, multiplicateur: 1.4, malusDefaite: 10 },
  { niveau: 5, seuilGainageSec: 180, seuilPompes: 50, multiplicateur: 1.8, malusDefaite: 14 },
];

const ROLE = {
  role: "MID", poidsMort: 2, poidsKill: 1, poidsAssist: 0.5, maitriseActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  p.roleWeight.findMany.mockResolvedValue([ROLE]);
  p.levelConfig.findMany.mockResolvedValue(NIVEAUX);
  p.masteryConfig.findFirst.mockResolvedValue({ surchargeMax: 0.5, partiesPourMax: 100 });
  p.game.count.mockResolvedValue(0);
  p.game.findFirst.mockResolvedValue(null);
  p.game.findMany.mockResolvedValue([]);
  p.game.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "g1", ...data }));
  p.user.update.mockResolvedValue({});
  p.goal.findUnique.mockResolvedValue(null);
  p.loginAttempt.deleteMany.mockResolvedValue({});
  p.loginAttempt.count.mockResolvedValue(0);
  p.loginAttempt.create.mockResolvedValue({});
});

const PARTIE = {
  jeu: "League of Legends", typeJeu: "parties", role: "MID",
  kills: 2, deaths: 9, assists: 4, result: "D",
};

async function pointsDesDeuxRoutes(body: Record<string, unknown>) {
  const a = await corps(await apercu(requete("/api/games/preview", { method: "POST", body })));
  const e = await corps(await enregistrer(requete("/api/games", { method: "POST", body })));
  const scoring = a.scoring as { pompesFinales: number };
  const ecrit = p.game.create.mock.calls[0][0].data as { pompesCalculees: number };
  return { apercu: scoring.pompesFinales, enregistre: ecrit.pompesCalculees, reponse: e };
}

describe("l'aperçu et l'enregistrement", () => {
  it("s'accordent quand aucun gainage n'est fourni — le cas de l'overlay", async () => {
    // Le compte a passé le test de pompes : c'est lui qui fixe le niveau. Son
    // `gainageMaxSec` est resté à la valeur d'origine, bien plus basse.
    session.mockResolvedValue(utilisateur({ pompesMax: 52, gainageMaxSec: 45 }));
    const { apercu: a, enregistre: e } = await pointsDesDeuxRoutes(PARTIE);
    expect(a).toBe(e);
  });

  it("s'accordent quand un gainage est fourni — le cas du formulaire", async () => {
    session.mockResolvedValue(utilisateur({ pompesMax: 52, gainageMaxSec: 45 }));
    const { apercu: a, enregistre: e } = await pointsDesDeuxRoutes({ ...PARTIE, gainageSec: 150 });
    expect(a).toBe(e);
  });

  it("s'accordent pour un compte qui n'a jamais fait le test de force", async () => {
    session.mockResolvedValue(utilisateur({ pompesMax: 0, gainageMaxSec: 130 }));
    const { apercu: a, enregistre: e } = await pointsDesDeuxRoutes(PARTIE);
    expect(a).toBe(e);
  });

  it("s'accordent sur une victoire comme sur une défaite", async () => {
    session.mockResolvedValue(utilisateur({ pompesMax: 52, gainageMaxSec: 45 }));
    const { apercu: a, enregistre: e } = await pointsDesDeuxRoutes({ ...PARTIE, result: "V" });
    expect(a).toBe(e);
  });

  it("le niveau vient bien du test de force, pas du gainage de repli", async () => {
    // Sans ce contrôle, les deux routes pourraient s'accorder sur le mauvais
    // niveau — un accord n'est pas une justesse.
    session.mockResolvedValue(utilisateur({ pompesMax: 52, gainageMaxSec: 45 }));
    const haut = await corps(await apercu(requete("/api/games/preview", { method: "POST", body: PARTIE })));

    session.mockResolvedValue(utilisateur({ pompesMax: 5, gainageMaxSec: 45 }));
    const bas = await corps(await apercu(requete("/api/games/preview", { method: "POST", body: PARTIE })));

    const points = (r: Record<string, unknown>) => (r.scoring as { pompesFinales: number }).pompesFinales;
    expect(points(haut)).toBeGreaterThan(points(bas));
  });
});

describe("l'aperçu rend la liste des exercices du compte", () => {
  it("pour que l'overlay n'affiche pas une sélection périmée", async () => {
    session.mockResolvedValue(utilisateur({ pompesMax: 52, exercices: ["pompes"] }));
    const r = await corps(await apercu(requete("/api/games/preview", { method: "POST", body: PARTIE })));
    expect(r.exercices).toEqual(["pompes"]);
  });
});
