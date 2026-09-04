import { requete, corps, utilisateur } from "@/test/api";
import { jourLocal } from "@/lib/serie";

jest.mock("@/lib/prisma", () => {
  const paiement = { create: jest.fn(), findUnique: jest.fn() };
  const user = { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() };
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
const user = prisma.user as unknown as { update: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
const paiement = (prisma as unknown as
  { paiement: { create: jest.Mock; findUnique: jest.Mock } }).paiement;

/** Ce que la base contient, entre deux appels des doublures. */
let compteur = 100;

const joueur = (champs: Record<string, unknown> = {}) =>
  utilisateur({ exercices: ["boxe"], dettePointsDus: 100, rappelSeuilSec: 300, ...champs });

beforeEach(() => {
  jest.clearAllMocks();
  appliquerRatios(RATIOS_DEFAUT);
  session.mockResolvedValue(joueur());
  paiement.findUnique.mockResolvedValue(null);
  user.updateMany.mockResolvedValue({ count: 1 });
  // Le retrait passe par `decrement`, qui est atomique côté base : la doublure
  // le simule. `compteur` tient lieu de valeur en base entre deux appels.
  compteur = 100;
  user.findUnique.mockImplementation(async () => ({ dettePointsDus: compteur }));
  user.update.mockImplementation(async ({ data }: { data: { dettePointsDus: number | { decrement: number } } }) => {
    const v = data.dettePointsDus;
    compteur = typeof v === "number" ? v : compteur - v.decrement;
    return { dettePointsDus: compteur, rappelSeuilSec: 300, exercices: ["boxe"] };
  });
  user.findUniqueOrThrow.mockImplementation(async () => ({
    dettePointsDus: compteur, rappelSeuilSec: 300, exercices: ["boxe"],
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
    // Le retrait est un décrément, pas une réécriture : c'est ce qui empêche
    // d'effacer une partie arrivée entre-temps.
    const r = await patch({ tout: true });
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ decrement: 100 });
    expect((await corps(r) as { points: number }).points).toBe(0);
  });

  it("ne paie que le temps réellement effectué", async () => {
    // 100 points de boxe valent 700 s ; 350 s effectuées en paient la moitié.
    const r = await patch({ secondes: 350 });
    expect(user.update.mock.calls[0][0].data.dettePointsDus).toEqual({ decrement: 50 });
    expect((await corps(r) as { points: number }).points).toBe(50);
  });

  it("solde la dette quand le temps effectué la dépasse", async () => {
    const r = await patch({ secondes: 99999 });
    expect((await corps(r) as { points: number }).points).toBe(0);
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
    // Rien à retirer, donc rien à écrire : le compteur est simplement relu.
    expect(user.update).not.toHaveBeenCalled();
    expect((await corps(r) as { points: number }).points).toBe(100);
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
    // Le repli est `jourLocal()` : vérifier la seule FORME du jour rendu
    // n'affirme rien, puisque cette fonction en produit toujours une juste.
    // C'est le jour LOCAL qu'on attend, et c'est ce qui distingue le repli
    // d'un jour inventé.
    expect(paiement.create.mock.calls[0][0].data.jour).toBe(jourLocal());
  });

  /**
   * La FORME d'une date ne dit pas qu'elle existe.
   *
   * « 2026-02-30 » et « 9999-99-99 » passent le motif, et ce jour est écrit
   * TEL QUEL dans `Paiement.jour` : il y resterait pour toujours. La série se
   * compte en remontant jour par jour depuis aujourd'hui — un paiement posé
   * sur un jour qu'aucun calendrier ne contient ne compte jamais, et l'effort
   * est fait pour rien.
   *
   * Le test qui précède ne pouvait pas l'attraper : il vérifiait la forme du
   * jour stocké, et ces deux valeurs-là l'ont.
   */
  it("refuse un jour bien formé qui n'existe pas", async () => {
    for (const faux of ["2026-02-30", "9999-99-99", "2025-02-29"]) {
      paiement.create.mockClear();
      session.mockResolvedValue(joueur({ dettePointsDus: 50 }));
      user.update.mockResolvedValue({ dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"] });
      await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true, jour: faux } }));

      const ecrit = paiement.create.mock.calls[0][0].data.jour as string;
      expect(ecrit).not.toBe(faux);
      // Et ce qui est écrit à la place est un vrai jour : l'aller-retour le
      // dit, là où le motif se laisse tromper.
      expect(new Date(`${ecrit}T00:00:00Z`).toISOString().slice(0, 10)).toBe(ecrit);
    }
  });

  it("n'écrit aucun paiement quand rien n'a été acquitté", async () => {
    session.mockResolvedValue(joueur({ dettePointsDus: 0 }));
    user.update.mockResolvedValue({ dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"] });
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(paiement.create).not.toHaveBeenCalled();
  });

  it("efface la date de début quand la dette est soldée, la garde sinon", async () => {
    // Un paiement partiel qui remettrait le compteur de retard à zéro
    // empêcherait quiconque d'être jamais en retard. La date se pose avec la
    // remise à zéro, dans la seconde écriture du retrait.
    session.mockResolvedValue(joueur({ dettePointsDus: 100 }));
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true } }));
    const ecritures = user.update.mock.calls.map((c) => c[0].data);
    expect(ecritures).toContainEqual({ dettePointsDus: 0, detteDepuis: null });

    jest.clearAllMocks();
    compteur = 100;
    session.mockResolvedValue(joueur({ dettePointsDus: 100 }));
    await PATCH(requete("/api/dette", { method: "PATCH", body: { secondes: 10 } }));
    for (const data of user.update.mock.calls.map((c) => c[0].data)) {
      expect(data).not.toHaveProperty("detteDepuis");
    }
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
    paiement.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    const r = await payer({ secondes: 60, jeton: "en-double" });
    expect(r.status).toBe(200);
  });

  it("rend la dette d'APRÈS le paiement jumeau, pas celle du début de requête", async () => {
    // Le compte lu au début de la requête porte la dette d'avant : le jumeau
    // a soldé entre-temps. La rendre telle quelle annoncerait à l'écran une
    // dette qu'on vient de payer, c'est-à-dire exactement ce que la file hors
    // ligne existe pour éviter.
    paiement.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    user.findUniqueOrThrow.mockResolvedValueOnce({
      dettePointsDus: 0, rappelSeuilSec: 300, exercices: ["boxe"],
    });
    const r = await payer({ secondes: 60, jeton: "en-double" });
    expect((await corps(r)).points).toBe(0);
  });

  it("ne masque pas une vraie panne de base", async () => {
    paiement.create.mockRejectedValueOnce(new Error("base injoignable"));
    await expect(payer({ secondes: 60, jeton: "x" })).rejects.toThrow("base injoignable");
  });

  /**
   * L'ordre des deux écritures, maintenant qu'il n'y a plus de transaction.
   *
   * Le pilote HTTP de Neon les refuse — voir `transactionsInterdites`. Il n'y
   * a donc plus rien pour rattraper une écriture qui passe et l'autre pas, et
   * l'ordre décide de ce qu'on perd :
   *
   * - la trace d'abord, le décompte ensuite : la dette reste due, la personne
   *   la refait. Désagréable, rattrapable ;
   * - l'inverse effacerait une dette sans trace, et le renvoi la décompterait
   *   une seconde fois. Ça ne se rattrape pas.
   */
  it("enregistre la trace AVANT de décompter", async () => {
    await payer({ secondes: 60 });
    const traceLe = paiement.create.mock.invocationCallOrder[0];
    const decompteLe = user.update.mock.invocationCallOrder[0];
    expect(traceLe).toBeLessThan(decompteLe);
  });

  it("ne décompte pas une séance déjà enregistrée", async () => {
    // Le renvoi d'une séance dont la trace existe déjà ne doit surtout pas
    // retirer les points une seconde fois : c'est le seul rôle du jeton.
    paiement.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    await payer({ secondes: 60, jeton: "deja-fait" });
    expect(user.update).not.toHaveBeenCalled();
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
    // Entre la lecture et l'écriture, une partie a ajouté trente points.
    compteur = 130;

    const r = await PATCH(requete("http://x/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(r.status).toBe(200);

    // Cent points payés, trente restants : la partie n'a pas été effacée.
    expect((await corps(r) as { points: number }).points).toBe(30);
  });

  it("solde bien la dette quand rien n'est arrivé entre-temps", async () => {
    session.mockResolvedValue(joueur({ dettePointsDus: 100 }));
    compteur = 100;

    const r = await PATCH(requete("http://x/api/dette", { method: "PATCH", body: { tout: true } }));
    expect((await corps(r) as { points: number }).points).toBe(0);
    expect(user.update.mock.calls.map((c) => c[0].data))
      .toContainEqual({ dettePointsDus: 0, detteDepuis: null });
  });
});

describe("l'exploit de la dette payée dans l'heure", () => {
  const ilYA = (ms: number) => new Date(Date.now() - ms);

  it("se pose quand la dette est SOLDÉE dans l'heure qui a suivi sa naissance", async () => {
    session.mockResolvedValue(joueur({ detteDepuis: ilYA(10 * 60 * 1000), paiementEclairLe: null }));
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(user.updateMany).toHaveBeenCalledTimes(1);
    const appel = user.updateMany.mock.calls[0][0];
    // La condition est posée à la BASE, pas après lecture : deux paiements
    // partis ensemble liraient tous deux « pas encore d'exploit », et le
    // second écraserait la date du premier.
    expect(appel.where).toMatchObject({ paiementEclairLe: null });
    expect(appel.where.id).toBeDefined();
    expect(appel.data.paiementEclairLe).toBeInstanceOf(Date);
  });

  it("ne se pose pas quand la dette n'est qu'ENTAMÉE", async () => {
    // « Payée dans l'heure » veut dire payée. Cinq secondes de boxe sur cent
    // points dus laissent la dette courir.
    session.mockResolvedValue(joueur({ detteDepuis: ilYA(60 * 1000), paiementEclairLe: null }));
    await PATCH(requete("/api/dette", { method: "PATCH", body: { secondes: 5 } }));
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("ne se pose pas au-delà de l'heure", async () => {
    session.mockResolvedValue(joueur({ detteDepuis: ilYA(3 * 60 * 60 * 1000), paiementEclairLe: null }));
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("ne se REPOSE pas quand il est déjà gagné", async () => {
    session.mockResolvedValue(joueur({
      detteDepuis: ilYA(60 * 1000),
      paiementEclairLe: new Date("2026-01-01T00:00:00Z"),
    }));
    await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("un exploit qui échoue ne fait PAS échouer le paiement", async () => {
    /**
     * L'ordre de ce fichier : la trace, le décompte, puis le badge. Ce qui
     * peut se refaire à la main passe en dernier, et son échec ne coûte que
     * lui-même. Un badge manqué se rattrape au prochain soir ; un paiement
     * refusé après que la dette a été décomptée, non.
     */
    session.mockResolvedValue(joueur({ detteDepuis: ilYA(60 * 1000), paiementEclairLe: null }));
    user.updateMany.mockRejectedValue(new Error("base indisponible"));
    const r = await PATCH(requete("/api/dette", { method: "PATCH", body: { tout: true } }));
    expect(r.status).toBe(200);
    expect(paiement.create).toHaveBeenCalledTimes(1);
  });
});
