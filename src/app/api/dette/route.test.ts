import { requete, corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => {
  const paiement = { create: jest.fn(), findUnique: jest.fn() };
  const user = { update: jest.fn(), findUnique: jest.fn() };
  return {
    prisma: {
      user, paiement,
      // Le paiement et la mise à jour du compteur partent ensemble : l'un sans
      // l'autre laisserait une série fausse ou une dette effacée sans trace.
      $transaction: jest.fn(async (travail: (tx: unknown) => unknown) =>
        travail({ user, paiement })),
    },
  };
});
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn() }));

import { GET, PATCH, PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { appliquerRatios, RATIOS_DEFAUT } from "@/lib/exercices";

const session = getCurrentUser as jest.Mock;
const user = prisma.user as unknown as { update: jest.Mock; findUnique: jest.Mock };
const paiement = (prisma as unknown as
  { paiement: { create: jest.Mock; findUnique: jest.Mock } }).paiement;

const joueur = (champs: Record<string, unknown> = {}) =>
  utilisateur({ exercices: ["boxe"], dettePointsDus: 100, rappelSeuilSec: 300, ...champs });

beforeEach(() => {
  jest.clearAllMocks();
  appliquerRatios(RATIOS_DEFAUT);
  session.mockResolvedValue(joueur());
  paiement.findUnique.mockResolvedValue(null);
  // La dette relue DANS la transaction : par défaut, la même qu'à la lecture.
  // Les tests qui éprouvent la course la changent.
  user.findUnique.mockResolvedValue({ dettePointsDus: 100 });
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

  it("ne crédite rien pour un temps absurde, et le dit", async () => {
    /**
     * Le refus a remplacé le silence.
     *
     * La route ramenait une durée négative à zéro et rendait 200 : rien
     * n'était crédité, ce qui était sûr, mais l'appelant ne savait pas que sa
     * valeur n'avait pas été comprise. La file hors ligne, elle, aurait
     * réessayé indéfiniment. Un 4xx la fait renoncer sur cette entrée-là.
     */
    const r = await patch({ secondes: -500 });
    expect(r.status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("accepte un temps nul : c'est un abandon immédiat, pas une erreur", async () => {
    const r = await patch({ secondes: 0 });
    expect(r.status).toBe(200);
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toBe(100);
  });

  it("n'écrit que sur le compte du demandeur", async () => {
    session.mockResolvedValue(joueur({ id: "u42" }));
    await patch({ tout: true });
    expect(user.update.mock.calls[0][0].where).toEqual({ id: "u42" });
  });

  it("survit à un corps illisible, et le refuse", async () => {
    // Elle ne doit pas tomber ; elle ne doit pas non plus faire comme si la
    // demande avait été comprise. Un corps qu'on ne sait pas lire ne dit ni
    // « tout est fait » ni « voilà combien ».
    const r = await PATCH(new Request("http://localhost/api/dette", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{cassé",
    }));
    expect(r.status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
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

/**
 * Le paiement laisse une trace.
 *
 * Sans elle, une série de jours consécutifs ne se calcule pas — et elle ne se
 * rattrape pas après coup : ce qui n'a pas été écrit ce jour-là est perdu.
 */
describe("trace du paiement", () => {
  it("écrit un paiement avec les points réellement acquittés", async () => {
    session.mockResolvedValue(joueur({ dettePointsDus: 100 }));
    user.update.mockResolvedValue({ dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"] });
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true, jour: "2026-08-23" } }));
    expect(paiement.create.mock.calls[0][0].data).toMatchObject({
      points: 100, jour: "2026-08-23",
    });
  });

  it("prend le jour du navigateur, et refuse un jour mal formé", async () => {
    // Le jour UTC ferait basculer la série d'un jour sur l'autre selon le
    // fuseau de la personne.
    session.mockResolvedValue(joueur({ dettePointsDus: 50 }));
    user.update.mockResolvedValue({ dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"] });
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true, jour: "pas un jour" } }));
    expect(paiement.create.mock.calls[0][0].data.jour).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("n'écrit aucun paiement quand rien n'a été acquitté", async () => {
    session.mockResolvedValue(joueur({ dettePointsDus: 0 }));
    user.update.mockResolvedValue({ dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"] });
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(paiement.create).not.toHaveBeenCalled();
  });

  it("efface la date de début quand la dette est soldée, la garde sinon", async () => {
    // Un paiement partiel qui remettrait le compteur de retard à zéro
    // empêcherait quiconque d'être jamais en retard.
    session.mockResolvedValue(joueur({ dettePointsDus: 100 }));
    user.update.mockResolvedValue({ dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"] });
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(user.update.mock.calls[0][0].data).toHaveProperty("detteDepuis", null);

    jest.clearAllMocks();
    session.mockResolvedValue(joueur({ dettePointsDus: 100 }));
    user.update.mockResolvedValue({ dettePointsDus: 60, rappelSeuilSec: 300, exercices: ["boxe"] });
    await PATCH(requete("/api/dette", { method: "PATCH", body: { secondes: 10 } }));
    expect(user.update.mock.calls[0][0].data).not.toHaveProperty("detteDepuis");
  });
});


/**
 * Le jeton d'unicité des séances rejouées depuis la file hors ligne.
 *
 * Un téléphone qui retrouve le réseau réessaie tant qu'il n'a pas reçu de
 * réponse — et une réponse perdue en chemin est indiscernable d'une requête
 * jamais arrivée. Sans jeton, ce cas-là paie deux fois la même séance, ce qui
 * efface une dette qu'on n'a pas faite.
 */
describe("le jeton d'un paiement rejoué", () => {
  const payer = (corpsRequete: Record<string, unknown>) =>
    PATCH(requete("/api/dette", { method: "PATCH", body: corpsRequete }));

  it("est écrit avec le paiement", async () => {
    await payer({ secondes: 60, jeton: "abc-123" });
    expect(paiement.create.mock.calls[0][0].data.jeton).toBe("abc-123");
  });

  it("vaut null quand le paiement vient d'un écran en ligne", async () => {
    // Poser un jeton à tout le monde n'ajouterait qu'une colonne à indexer.
    await payer({ secondes: 60 });
    expect(paiement.create.mock.calls[0][0].data.jeton).toBeNull();
  });

  it("n'applique pas deux fois le même paiement", async () => {
    paiement.findUnique.mockResolvedValue({ userId: joueur().id });
    const r = await payer({ tout: true, jeton: "deja-vu" });
    expect(r.status).toBe(200);
    expect(paiement.create).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
    // La réponse reste celle de l'état courant : le navigateur qui rejoue doit
    // pouvoir se resynchroniser dessus.
    expect((await corps(r)).points).toBe(100);
  });

  it("ignore un jeton qui appartient à quelqu'un d'autre", async () => {
    // Il ne dit rien de ce compte-ci. Refuser sur cette base ferait perdre une
    // séance réellement faite, sur une collision qui ne le concerne pas.
    paiement.findUnique.mockResolvedValue({ userId: "un-autre-compte" });
    await payer({ tout: true, jeton: "pas-le-mien" });
    expect(paiement.create).toHaveBeenCalled();
  });

  it("rend l'état courant plutôt qu'une erreur si deux renvois se croisent", async () => {
    // Deux envois partis en même temps passent tous deux le contrôle de
    // lecture : c'est l'unicité en base qui tranche. Une erreur ici ferait
    // réessayer la file indéfiniment sur un paiement pourtant enregistré.
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    const r = await payer({ secondes: 60, jeton: "en-double" });
    expect(r.status).toBe(200);
    expect((await corps(r)).points).toBe(100);
  });

  it("ne masque pas une vraie panne de base", async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error("base injoignable"));
    await expect(payer({ secondes: 60, jeton: "x" })).rejects.toThrow("base injoignable");
  });

  it("tronque un jeton démesuré plutôt que de l'écrire tel quel", async () => {
    await payer({ secondes: 60, jeton: "z".repeat(500) });
    expect(paiement.create.mock.calls[0][0].data.jeton).toHaveLength(64);
  });
});

/**
 * Une durée impossible ne vaut pas « tout est fait ».
 *
 * `Number(x) || 0` acceptait `1e308` : la proportion payée était plafonnée à
 * un, et la dette entière disparaissait. Quarante-sept points effacés par une
 * valeur que personne ne peut avoir faite.
 */
describe("les bornes du paiement partiel", () => {
  const payer = (corpsRequete: Record<string, unknown>) =>
    PATCH(requete("/api/dette", { method: "PATCH", body: corpsRequete }));

  it("refuse une durée qui n'en est pas une", async () => {
    for (const aberrant of [1e308, -500, "abc", {}, NaN]) {
      const r = await payer({ secondes: aberrant });
      expect(r.status).toBe(400);
    }
    expect(user.update).not.toHaveBeenCalled();
  });

  it("accepte encore d'avoir fait plus que ce qui était dû", async () => {
    // Dix minutes faites sur cinq dues : c'est le cas légitime, et le
    // plafonnement à cent pour cent reste là pour lui.
    const r = await payer({ secondes: 3600 });
    expect(r.status).toBe(200);
    expect((await corps(r)).points).toBe(0);
  });

  it("laisse « tout est fait » explicite passer sans durée", async () => {
    expect((await payer({ tout: true })).status).toBe(200);
  });
});

describe("la course entre un paiement et une partie", () => {
  it("décrémente au lieu de réécrire, pour ne pas effacer ce qui vient d'arriver", async () => {
    // Le cas réel : on finit sa série au moment où l'application de bureau
    // enregistre la partie qu'on vient de quitter. La dette était réécrite en
    // valeur ABSOLUE, calculée avant la transaction : la partie disparaissait.
    session.mockResolvedValue(joueur({ dettePointsDus: 100 }));
    // Entre la lecture et la transaction, une partie a ajouté trente points.
    user.findUnique.mockResolvedValue({ dettePointsDus: 130 });

    const r = await PATCH(requete("http://x/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(r.status).toBe(200);

    // Cent points payés, trente restants : la partie n'a pas été effacée.
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dettePointsDus: 30 }) }),
    );
  });

  it("solde bien la dette quand rien n'est arrivé entre-temps", async () => {
    session.mockResolvedValue(joueur({ dettePointsDus: 100 }));
    user.findUnique.mockResolvedValue({ dettePointsDus: 100 });

    await PATCH(requete("http://x/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dettePointsDus: 0, detteDepuis: null }),
      }),
    );
  });
});
