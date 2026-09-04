import { corps, requete, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    amitie: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    paiement: { groupBy: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { JOURS_CLASSEMENT } from "@/lib/classement";
import { jourLocal } from "@/lib/serie";

const session = getCurrentUser as jest.Mock;
const db = prisma as unknown as {
  amitie: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
  paiement: { groupBy: jest.Mock };
};

/**
 * Ce que les deux `groupBy` rendent, séparément.
 *
 * La route en fait deux : les sommes de la fenêtre, et les jours payés du mur
 * des records. Une doublure qui rendrait la même chose aux deux ferait lire
 * des sommes comme des jours — et le mur planterait sur un `jour` absent.
 * `poserSommes` remplace donc `mockResolvedValue` dans les tests.
 */
let sommes: unknown[] = [];
let joursRecords: unknown[] = [];
const poserSommes = (v: unknown[]) => { sommes = v; };

const personne = (id: string, pseudo: string, extra = {}) =>
  ({ id, pseudo, detteDepuis: null, dettePointsDus: 0, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({ id: "moi" }));
  db.amitie.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([personne("moi", "Moi")]);
  sommes = [];
  joursRecords = [];
  // Deux `groupBy` partent maintenant : les sommes, puis les jours du mur des
  // records. Une doublure qui rend la même chose aux deux ferait lire des
  // sommes comme des jours.
  db.paiement.groupBy.mockImplementation(async (a: { by: string[] }) =>
    (a.by.includes("jour") ? joursRecords : sommes));
});

type Ligne = {
  id: string; pseudo: string; points: number; rang: number;
  moi: boolean; enRetard: boolean; joursDeRetard: number;
};
type Reponse = { lignes: Ligne[]; debut: string; jours: number; ecart: number | null };

const lire = async (jour?: string): Promise<Response> =>
  GET(requete(`/api/classement${jour ? `?jour=${jour}` : ""}`));

const lu = async (jour?: string): Promise<Reponse> =>
  (await corps(await lire(jour))) as Reponse;

describe("accès", () => {
  it("refuse sans session, et ne lit rien", async () => {
    session.mockResolvedValue(null);
    expect((await lire()).status).toBe(401);
    expect(db.amitie.findMany).not.toHaveBeenCalled();
    expect(db.paiement.groupBy).not.toHaveBeenCalled();
  });
});

describe("qui figure au classement", () => {
  it("soi-même y figure, même sans un seul ami", async () => {
    const c = await lu();
    expect(c.lignes).toEqual([expect.objectContaining({ pseudo: "Moi", moi: true, points: 0, rang: 1 })]);
  });

  it("prend les deux sens de l'amitié, et seulement les acceptées", async () => {
    db.amitie.findMany.mockResolvedValue([
      { demandeurId: "moi", receveurId: "a" },
      { demandeurId: "b", receveurId: "moi" },
    ]);
    await lire();
    expect(db.user.findMany.mock.calls[0][0].where.id.in.sort()).toEqual(["a", "b", "moi"]);
    expect(db.amitie.findMany.mock.calls[0][0].where.etat).toBe("acceptee");
  });

  /**
   * Le témoin du filtrage : la somme des paiements ne porte QUE sur les
   * identifiants tirés de l'amitié. Sans ce `where`, la route rendrait le
   * volume payé de toute la base — c'est-à-dire le classement de gens qui
   * n'ont rien demandé.
   */
  it("ne somme les paiements que des comptes retenus", async () => {
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    await lire();
    expect(db.paiement.groupBy.mock.calls[0][0].where.userId.in.sort()).toEqual(["a", "moi"]);
  });

  it("ne rend que le pseudo, les points et le retard : jamais le compte", async () => {
    db.user.findMany.mockResolvedValue([
      personne("moi", "Moi"),
      personne("a", "Alice"),
    ]);
    const c = await lu();
    for (const l of c.lignes) {
      expect(Object.keys(l).sort()).toEqual(
        ["enRetard", "id", "joursDeRetard", "moi", "points", "pseudo", "rang"]);
    }
  });
});

/**
 * Le mode fantôme.
 *
 * Il ferme un trou que le classement a ouvert : celui-ci publie le pseudo et
 * l'état de retard à tous ses amis, et la seule façon d'en sortir était de
 * retirer l'ami — c'est-à-dire de casser le lien pour éviter ce qu'il montre.
 */
describe("le mode fantôme", () => {
  it("écarte les fantômes à la LECTURE, pas à l'affichage", async () => {
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    await lire();
    /**
     * La condition part en base. Filtrée après coup, la ligne sortirait quand
     * même de la base et traverserait le réseau : elle serait dans l'onglet
     * réseau de qui regarde, c'est-à-dire exactement là où quelqu'un a demandé
     * à ne pas être.
     */
    expect(db.user.findMany.mock.calls[0][0].where.OR)
      .toEqual([{ fantome: false }, { id: "moi" }]);
  });

  it("se voit toujours soi-même, fantôme ou non", async () => {
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    await lire();
    const ou = db.user.findMany.mock.calls[0][0].where.OR as Array<Record<string, unknown>>;
    // Un classement où l'on ne figure pas n'est pas son classement, et se
    // cacher des autres n'est pas se cacher de soi.
    expect(ou.some((c) => c.id === "moi")).toBe(true);
  });
});

describe("la fenêtre", () => {
  it("va des sept derniers jours à aujourd'hui, bornée des deux côtés", async () => {
    const c = await lu("2026-09-03");
    expect(c.debut).toBe("2026-08-28");
    expect(c.jours).toBe(JOURS_CLASSEMENT);
    expect(db.paiement.groupBy.mock.calls[0][0].where.jour)
      .toEqual({ gte: "2026-08-28", lte: "2026-09-03" });
  });

  /**
   * « 9999-99-99 » respecte la forme et n'est pas une date. Le repli est le
   * jour local, pas un jour inventé : le contrôle porte sur l'aller-retour,
   * comme dans `/api/progression` où le motif seul avait rendu une série de
   * zéro.
   */
  it("un jour impossible retombe sur le jour local, pas sur lui-même", async () => {
    const c = await lu("9999-99-99");
    expect(c.debut).not.toContain("9999");
    expect(db.paiement.groupBy.mock.calls[0][0].where.jour.lte).toBe(jourLocal());
  });

  it("une fenêtre sans paiement rend zéro, pas une absence", async () => {
    poserSommes([{ userId: "moi", _sum: { points: null } }]);
    const c = await lu();
    expect(c.lignes[0].points).toBe(0);
  });
});

describe("ce que le classement dit", () => {
  it("ordonne sur le volume payé et donne l'écart au premier", async () => {
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    db.user.findMany.mockResolvedValue([personne("moi", "Moi"), personne("a", "Alice")]);
    poserSommes([
      { userId: "moi", _sum: { points: 40 } },
      { userId: "a", _sum: { points: 150 } },
    ]);
    const c = await lu();
    expect(c.lignes.map((l) => l.pseudo)).toEqual(["Alice", "Moi"]);
    expect(c.ecart).toBe(110);
  });

  it("dit qu'un ami est en retard, avec le nombre de jours", async () => {
    const vieux = new Date(Date.now() - 5 * 86_400_000);
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    db.user.findMany.mockResolvedValue([
      personne("moi", "Moi"),
      personne("a", "Alice", { detteDepuis: vieux, dettePointsDus: 60 }),
    ]);
    const c = await lu();
    const alice = c.lignes.find((l) => l.pseudo === "Alice")!;
    expect(alice.enRetard).toBe(true);
    expect(alice.joursDeRetard).toBe(5);
  });
});

describe("les deux onglets", () => {
  const bornes = async (adresse: string) => {
    await GET(requete(adresse));
    // La requête des SOMMES, pas celle du mur : les deux partent maintenant, et
    // celle du mur borne toujours de la même façon. Prendre le dernier appel
    // ferait passer les deux onglets pour identiques.
    type Appel = { by: string[]; where: { jour: { gte?: string; lte?: string } } };
    const appels: Appel[] = db.paiement.groupBy.mock.calls.map((c: [Appel]) => c[0]);
    const somme = appels.find((a) => !a.by.includes("jour"));
    // Le témoin : sans lui, une route qui cesserait de sommer rendrait un
    // `undefined` que les contrôles ci-dessous liraient comme « pas de borne ».
    expect(somme).toBeDefined();
    return (somme as Appel).where.jour;
  };

  it("la semaine borne des DEUX côtés", async () => {
    const jour = await bornes("/api/classement?jour=2026-09-04");
    expect(jour.gte).toBeDefined();
    expect(jour.lte).toBe("2026-09-04");
  });

  it("le cumul ne borne QUE le haut", async () => {
    /**
     * La borne haute reste dans les deux cas : sans elle, un paiement daté du
     * futur entrerait au cumul comme il entrait dans la semaine. La borne
     * basse, elle, disparaît — c'est ce qui fait le cumul.
     */
    const jour = await bornes("/api/classement?jour=2026-09-04&periode=total");
    expect(jour.gte).toBeUndefined();
    expect(jour.lte).toBe("2026-09-04");
  });

  it("une période inconnue retombe sur la SEMAINE, pas sur le cumul", async () => {
    // Un paramètre mal écrit ne doit pas ouvrir l'onglet qui décourage un
    // compte neuf.
    const jour = await bornes("/api/classement?jour=2026-09-04&periode=cumul");
    expect(jour.gte).toBeDefined();
  });

  it("la réponse dit quelle période elle porte", async () => {
    // Sans ça, l'écran ne pourrait pas savoir si la réponse qui arrive est
    // celle de l'onglet qu'on vient d'ouvrir ou celle d'avant.
    const r = await corps(await GET(requete("/api/classement?jour=2026-09-04&periode=total")));
    expect(r.periode).toBe("total");
  });
});

describe("le mur des records", () => {
  it("retient le plus gros JOUR du cercle, et pas la plus grosse somme", async () => {
    /**
     * Ce qui le distingue du classement, dans la même réponse : celui-ci
     * additionne la fenêtre, celui-là prend une pointe. Alice paie plus au
     * total sur la semaine, Moi a fait la plus grosse soirée.
     */
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "a" }]);
    db.user.findMany.mockResolvedValue([personne("moi", "Moi"), personne("a", "Alice")]);
    poserSommes([
      { userId: "moi", _sum: { points: 400 } },
      { userId: "a", _sum: { points: 900 } },
    ]);
    joursRecords = [
      { userId: "moi", jour: "2026-09-02", _sum: { points: 400 } },
      { userId: "a", jour: "2026-09-01", _sum: { points: 300 } },
      { userId: "a", jour: "2026-09-02", _sum: { points: 300 } },
      { userId: "a", jour: "2026-09-03", _sum: { points: 300 } },
    ];
    const c = await corps(await GET(requete("/api/classement?jour=2026-09-04"))) as {
      lignes: { pseudo: string }[];
      records: { mois: { pseudo: string; points: number } | null };
    };
    expect(c.lignes[0].pseudo).toBe("Alice");
    expect(c.records.mois).toMatchObject({ pseudo: "Moi", points: 400 });
  });

  it("regroupe par compte ET par jour, sans borne basse", async () => {
    // Le record de toujours n'a pas de fenêtre ; celui du mois se découpe
    // ensuite sur le préfixe. Une borne basse ici les couperait tous les deux.
    await GET(requete("/api/classement?jour=2026-09-04"));
    type Appel = { by: string[]; where: { jour: { gte?: string; lte?: string } } };
    const appels: Appel[] = db.paiement.groupBy.mock.calls.map((c: [Appel]) => c[0]);
    const mur = appels.find((a) => a.by.includes("jour"));
    expect(mur).toBeDefined();
    expect((mur as Appel).by).toEqual(["userId", "jour"]);
    expect((mur as Appel).where.jour.gte).toBeUndefined();
    expect((mur as Appel).where.jour.lte).toBe("2026-09-04");
  });

  it("ne fait pas réapparaître quelqu'un qui s'est retiré des classements", async () => {
    /**
     * Le mur lit les pseudos des LIGNES, déjà passées par le filtre du mode
     * fantôme. Sans ça, se cacher du classement laisserait le record en haut
     * de l'écran, ce qui est le pire endroit possible.
     */
    db.amitie.findMany.mockResolvedValue([{ demandeurId: "moi", receveurId: "f" }]);
    db.user.findMany.mockResolvedValue([personne("moi", "Moi")]);
    joursRecords = [
      { userId: "f", jour: "2026-09-01", _sum: { points: 9000 } },
      { userId: "moi", jour: "2026-09-02", _sum: { points: 40 } },
    ];
    const c = await corps(await GET(requete("/api/classement?jour=2026-09-04"))) as {
      records: { toujours: { pseudo: string; points: number } | null };
    };
    expect(c.records.toujours).toMatchObject({ pseudo: "Moi", points: 40 });
  });
});

describe("le mur ouvert à tous", () => {
  it("ne part pas du tout quand personne n'a ouvert le sien", async () => {
    /**
     * Le défaut est fermé, donc le cas courant est qu'il n'y ait personne.
     * Une seconde lecture de paiements pour zéro compte serait un
     * aller-retour vers Neon à chaque ouverture de l'écran.
     */
    db.user.findMany.mockImplementation(async (a: { where?: { recordsPublics?: boolean } }) =>
      (a.where?.recordsPublics ? [] : [personne("moi", "Moi")]));
    const c = await corps(await GET(requete("/api/classement?jour=2026-09-04"))) as {
      recordsOuverts: unknown;
    };
    expect(c.recordsOuverts).toBeNull();
    // Une seule lecture de jours : celle du cercle.
    const parJour = db.paiement.groupBy.mock.calls
      .map((k: [{ by: string[] }]) => k[0]).filter((a: { by: string[] }) => a.by.includes("jour"));
    expect(parJour).toHaveLength(1);
  });

  it("ne retient que les comptes OUVERTS et non fantômes", async () => {
    /**
     * Les deux conditions sont en base, et c'est ce que ce contrôle regarde :
     * filtrer à l'affichage ferait sortir le pseudo et le volume de quelqu'un
     * qui a demandé l'inverse, et ils seraient dans l'onglet réseau de qui
     * regarde.
     */
    db.user.findMany.mockImplementation(async (a: { where?: { recordsPublics?: boolean } }) =>
      (a.where?.recordsPublics ? [{ id: "o", pseudo: "Ouvert", riotId: null, nomAffiche: "pseudo" }] : [personne("moi", "Moi")]));
    db.paiement.groupBy.mockImplementation(async (a: { by: string[]; where: { userId: { in: string[] } } }) => {
      if (!a.by.includes("jour")) return sommes;
      return a.where.userId.in.includes("o")
        ? [{ userId: "o", jour: "2026-09-01", _sum: { points: 777 } }]
        : joursRecords;
    });
    const c = await corps(await GET(requete("/api/classement?jour=2026-09-04"))) as {
      recordsOuverts: { toujours: { pseudo: string; points: number } | null };
    };
    expect(c.recordsOuverts.toujours).toMatchObject({ pseudo: "Ouvert", points: 777 });

    const appel = db.user.findMany.mock.calls
      .map((k: [{ where?: { recordsPublics?: boolean; fantome?: boolean } }]) => k[0])
      .find((a: { where?: { recordsPublics?: boolean } }) => a.where?.recordsPublics === true);
    expect(appel).toBeDefined();
    expect((appel as { where: Record<string, unknown> }).where)
      .toMatchObject({ recordsPublics: true, fantome: false });
  });
});
