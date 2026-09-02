import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { updateMany: jest.fn(), deleteMany: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    roleWeight: { findMany: jest.fn() },
    levelConfig: { findMany: jest.fn() },
    masteryConfig: { findFirst: jest.fn() },
  },
}));
// La configuration de barème est semée par la route quand elle manque : ici
// la base est doublée, il n'y a rien à semer.
jest.mock("@/lib/seed-defaults", () => ({ seedDefaults: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { PATCH, DELETE } from "./route";
import { oublierBareme } from "@/lib/baremeConfig";
import { prisma } from "@/lib/prisma";
import { MAITRISE_DEFAUT, NIVEAUX_DEFAUT, ROLES_DEFAUT } from "@/lib/scoringDefaut";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;
const game = prisma.game as unknown as { updateMany: jest.Mock; deleteMany: jest.Mock; findFirst: jest.Mock };
const user = prisma.user as unknown as { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
const bareme = prisma as unknown as {
  roleWeight: { findMany: jest.Mock };
  levelConfig: { findMany: jest.Mock };
  masteryConfig: { findFirst: jest.Mock };
};

/**
 * Une partie de League telle qu'elle est en base, à corriger.
 *
 * Le barème employé est celui livré avec l'application : la doublure rend les
 * vraies constantes plutôt que des nombres inventés. Un test écrit sur un
 * barème de fantaisie éprouve l'arithmétique, pas le produit.
 *
 * Mid, 5/4/3, niveau 1 : morts 3,0 × 4 − kills 1,3 × 5 − assists 1,0 × 3 = 2,5,
 * arrondi à 3. En défaite le malus de 5 s'ajoute, soit 8 points ; en victoire
 * le score de base est divisé par deux, soit 2.
 */
const PARTIE = {
  role: "Mid", kills: 5, deaths: 4, assists: 3, arrets: null,
  result: "D", gainageSec: 45, niveauCalcule: 1, partiesAvantCalcule: 0,
  pompesCalculees: 8, exercice: "boxe", repartition: null,
  jeu: "League of Legends", typeJeu: "parties", dureeSec: null, fileClassee: null,
};

/** Ce que la base contient, entre deux appels de la doublure d'`update`. */
let compteur = 100;

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: unknown) =>
  PATCH(requete(`/api/games/${id}`, { method: "PATCH", body }), params(id));

beforeEach(() => {
  /**
   * Le barème est mis en cache au niveau du module : une valeur retenue par un
   * cas précédent survivrait au suivant, et le cas « configuration absente »
   * passerait alors sur les paliers d'un autre test. C'est un état partagé, il
   * se réinitialise comme les doublures.
   */
  oublierBareme();
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur());
  game.updateMany.mockResolvedValue({ count: 1 });
  game.deleteMany.mockResolvedValue({ count: 1 });
  game.findFirst.mockResolvedValue({ exercice: "pompes", repartition: null, pompesCalculees: 38 });
  user.findUnique.mockResolvedValue({ dettePointsDus: 100 });
  // Le retrait passe par `decrement`, qui est atomique côté base. La doublure
  // le simule : sans ça, on éprouverait une écriture absolue qui n'existe plus.
  compteur = 100;
  user.update.mockImplementation(async ({ data }: { data: { dettePointsDus: number | { decrement?: number; increment?: number } } }) => {
    const v = data.dettePointsDus;
    if (typeof v === "number") compteur = v;
    else if (v.decrement != null) compteur -= v.decrement;
    else if (v.increment != null) compteur += v.increment;
    return { dettePointsDus: compteur };
  });
  user.updateMany.mockResolvedValue({ count: 1 });
  bareme.roleWeight.findMany.mockResolvedValue(ROLES_DEFAUT);
  bareme.levelConfig.findMany.mockResolvedValue(NIVEAUX_DEFAUT);
  bareme.masteryConfig.findFirst.mockResolvedValue(MAITRISE_DEFAUT);
});

/**
 * Modifier ou supprimer une partie touche deux choses : la ligne elle-même, et
 * le compteur de dette qu'elle avait alimenté. Les deux sont éprouvés, ainsi
 * que la seule règle qui protège vraiment les comptes entre eux : toute
 * requête est filtrée sur l'identifiant du demandeur.
 */
describe("PATCH /api/games/[id]", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await patch("g1", { date: "2026-01-01T10:00" })).status).toBe(401);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("corrige la date d'une partie", async () => {
    const r = await patch("g1", { date: "2026-01-01T10:00" });
    expect(r.status).toBe(200);
    expect(game.updateMany.mock.calls[0][0].where).toEqual({ id: "g1", userId: "u1" });
  });

  it("ne touche jamais qu'aux parties du demandeur", async () => {
    // La restriction porte sur la requête elle-même, pas sur un test préalable :
    // il n'existe donc pas de fenêtre où la partie d'un autre serait modifiable.
    session.mockResolvedValue(utilisateur({ id: "autre" }));
    await patch("g1", { date: "2026-01-01T10:00" });
    expect(game.updateMany.mock.calls[0][0].where.userId).toBe("autre");
  });

  it("répond 404 quand la partie n'appartient pas au demandeur", async () => {
    game.updateMany.mockResolvedValue({ count: 0 });
    expect((await patch("g1", { date: "2026-01-01T10:00" })).status).toBe(404);
  });

  it("refuse une date absente", async () => {
    const r = await patch("g1", {});
    expect(r.status).toBe(400);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("refuse une date dans le futur", async () => {
    const demain = new Date(Date.now() + 86_400_000).toISOString();
    const r = await patch("g1", { date: demain });
    expect(r.status).toBe(400);
    expect(String((await corps(r)).error)).toMatch(/futur/);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("refuse une date qui n'en est pas une", async () => {
    expect((await patch("g1", { date: "hier soir" })).status).toBe(400);
  });
});

/**
 * Corriger le résultat d'une partie enregistrée.
 *
 * Ce n'est pas une modification de champ : c'est un recalcul. Une victoire
 * prise pour une défaite a créé une dette qui n'était pas due — le défaut
 * qu'on a passé une nuit à empêcher de se reproduire — et la seule façon de la
 * reprendre était de supprimer la partie, c'est-à-dire de la perdre.
 */
describe("PATCH /api/games/[id] — le résultat", () => {
  const donnees = () => game.updateMany.mock.calls[0][0].data;

  // La doublure commune sert la suppression, qui ne lit que trois colonnes.
  // Corriger un résultat relit toute la partie : c'est elle qu'on pose ici.
  beforeEach(() => { game.findFirst.mockResolvedValue(PARTIE); });

  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await patch("g1", { result: "V" })).status).toBe(401);
    expect(game.findFirst).not.toHaveBeenCalled();
  });

  it("refuse un résultat qui n'en est pas un", async () => {
    for (const result of ["v", "N", "gagné", 1, true]) {
      expect((await patch("g1", { result })).status).toBe(400);
    }
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("ne lit jamais que les parties du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "autre" }));
    await patch("g1", { result: "V" });
    expect(game.findFirst.mock.calls[0][0].where).toEqual({ id: "g1", userId: "autre" });
    expect(game.updateMany.mock.calls[0][0].where).toEqual({ id: "g1", userId: "autre" });
  });

  it("répond 404 quand la partie n'appartient pas au demandeur", async () => {
    game.findFirst.mockResolvedValue(null);
    expect((await patch("g1", { result: "V" })).status).toBe(404);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("rejoue le barème au lieu de réécrire la seule lettre", async () => {
    const r = await patch("g1", { result: "V" });
    expect(r.status).toBe(200);
    // La défaite valait 8 points ; la victoire en vaut 2. Un champ réécrit
    // seul laisserait 8 à l'écran, c'est-à-dire une dette qu'on ne doit plus.
    expect(donnees().pompesCalculees).toBe(2);
    expect(donnees().result).toBe("V");
    expect(donnees().malusCalcule).toBe(0);
  });

  it("rend au compteur l'écart de dette, par décrément atomique", async () => {
    const r = await patch("g1", { result: "V" });
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ decrement: 6 });
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(94);
  });

  it("ajoute au compteur quand la correction va dans l'autre sens", async () => {
    game.findFirst.mockResolvedValue({ ...PARTIE, result: "V", pompesCalculees: 2 });
    const r = await patch("g1", { result: "D" });
    expect(donnees().pompesCalculees).toBe(8);
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ increment: 6 });
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(106);
  });

  it("laisse le compteur tranquille pour un exercice sans attente", async () => {
    // Des pompes se font dans la foulée de la partie : elles ne sont jamais
    // entrées au compteur, donc il n'y a rien à leur reprendre.
    game.findFirst.mockResolvedValue({ ...PARTIE, exercice: "pompes" });
    await patch("g1", { result: "V" });
    expect(donnees().pompesCalculees).toBe(2);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("ne touche à rien quand le résultat est déjà celui-là", async () => {
    // Deux clics de suite ne doivent pas payer la correction deux fois.
    const r = await patch("g1", { result: "D" });
    expect(r.status).toBe(200);
    expect(game.updateMany).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it("relit le niveau sur la partie, jamais sur le compte d'aujourd'hui", async () => {
    // Quelqu'un qui a refait son test de force entre-temps ne doit pas voir
    // une vieille partie changer de coût pour une raison sans rapport avec ce
    // qu'il vient de corriger. Au niveau 3, le multiplicateur vaut 2,33 :
    // 2,5 × 2,33 = 5,825, arrondi à 6, divisé par deux en victoire = 3.
    game.findFirst.mockResolvedValue({ ...PARTIE, niveauCalcule: 3 });
    await patch("g1", { result: "V" });
    expect(donnees().niveauCalcule).toBe(3);
    expect(donnees().pompesCalculees).toBe(3);
  });

  it("garde les mêmes exercices et ne redistribue que le total", async () => {
    // La sélection a été figée à l'enregistrement pour que l'historique reste
    // fidèle même si les réglages changent. Une correction ne la rouvre pas.
    game.findFirst.mockResolvedValue({
      ...PARTIE, exercice: "pompes",
      repartition: JSON.stringify({ pompes: 4, boxe: 4 }),
    });
    await patch("g1", { result: "V" });
    expect(JSON.parse(donnees().repartition)).toEqual({ pompes: 1, boxe: 1 });
    // Seule la part en temps entre au compteur : 4 points de boxe deviennent 1.
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ decrement: 3 });
  });

  it("refuse une séance au temps, qui n'a pas de résultat", async () => {
    game.findFirst.mockResolvedValue({ ...PARTIE, typeJeu: "temps", result: "N" });
    const r = await patch("g1", { result: "V" });
    expect(r.status).toBe(400);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("refuse un battle royale, dont le résultat se déduit du classement", async () => {
    // L'écrire à la main donnerait une lettre que plus rien ne recalcule :
    // le classement, lui, resterait celui d'une défaite.
    game.findFirst.mockResolvedValue({ ...PARTIE, jeu: "Apex Legends", role: "—" });
    const r = await patch("g1", { result: "V" });
    expect(r.status).toBe(400);
    expect(String((await corps(r)).error)).toMatch(/classement/);
    expect(game.updateMany).not.toHaveBeenCalled();
  });

  it("dit ce qui manque plutôt que de tomber quand le barème est absent", async () => {
    bareme.levelConfig.findMany.mockResolvedValue([]);
    expect((await patch("g1", { result: "V" })).status).toBe(500);
    expect(game.updateMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/games/[id]", () => {
  const del = (id: string) => DELETE(requete(`/api/games/${id}`, { method: "DELETE" }), params(id));

  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await del("g1")).status).toBe(401);
    expect(game.deleteMany).not.toHaveBeenCalled();
  });

  it("répond 404 quand la partie n'est pas celle du demandeur", async () => {
    game.findFirst.mockResolvedValue(null);
    expect((await del("g1")).status).toBe(404);
    expect(game.deleteMany).not.toHaveBeenCalled();
  });

  it("supprime la partie du demandeur", async () => {
    const r = await del("g1");
    expect(r.status).toBe(200);
    expect(game.deleteMany.mock.calls[0][0].where).toEqual({ id: "g1", userId: "u1" });
  });

  it("laisse le compteur tranquille pour un exercice sans attente", async () => {
    // Des pompes se font dans la foulée : elles n'entrent jamais au compteur,
    // donc les supprimer n'a rien à en retirer.
    await del("g1");
    expect(user.update).not.toHaveBeenCalled();
  });

  it("retire du compteur ce que la partie y avait mis", async () => {
    game.findFirst.mockResolvedValue({ exercice: "boxe", repartition: null, pompesCalculees: 38 });
    const r = await del("g1");
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ decrement: 38 });
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(62);
  });

  it("ne fait jamais passer le compteur sous zéro", async () => {
    game.findFirst.mockResolvedValue({ exercice: "boxe", repartition: null, pompesCalculees: 500 });
    compteur = 20;
    const r = await del("g1");
    // `decrement` n'a pas de plancher : la remise à zéro suit, avec la date de
    // début de dette qui n'a plus lieu d'être.
    expect(user.update.mock.calls[1][0].data)
      .toEqual({ dettePointsDus: 0, detteDepuis: null });
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(0);
  });

  it("ne retire que la part en attente d'une partie ventilée", async () => {
    game.findFirst.mockResolvedValue({
      exercice: "pompes",
      repartition: JSON.stringify({ pompes: 19, boxe: 19 }),
      pompesCalculees: 38,
    });
    const r = await del("g1");
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ decrement: 19 });
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(81);
  });

  it("retire un montant, pas un état : une partie arrivée entre-temps survit", async () => {
    // Le défaut : on lisait la dette, on calculait ce qui reste, on écrivait
    // cette valeur absolue. Une partie enregistrée entre les deux voyait sa
    // dette effacée.
    game.findFirst.mockResolvedValue({ exercice: "boxe", repartition: null, pompesCalculees: 38 });
    // La lecture initiale voit 100 ; la base en contient 130 au moment d'écrire.
    user.findUnique.mockResolvedValue({ dettePointsDus: 100 });
    compteur = 130;
    const r = await del("g1");
    expect((await corps(r) as { dettePointsDus: number }).dettePointsDus).toBe(92);
  });
});
