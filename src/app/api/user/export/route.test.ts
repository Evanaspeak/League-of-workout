import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findMany: jest.fn() },
    goal: { findUnique: jest.fn() },
    pushSubscription: { findMany: jest.fn() },
    paiement: { findMany: jest.fn() },
    signalement: { findMany: jest.fn() },
    demandeJeu: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));

import { GET } from "./route";
import { settings } from "@/lib/i18n/dictionaries/settings";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const session = getCurrentUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(utilisateur({
    passwordHash: "$2a$empreinte-secrete",
    sessionEpoch: 7,
    riotPuuid: "PUUID-SECRET-1234",
    poids: 75, taille: 180, age: 27, genre: "homme",
    createdAt: new Date("2026-06-01"), betaRank: 3,
    /**
     * Le compte est rempli, et ce n'est pas de la décoration.
     *
     * `JSON.stringify` OMET les clés dont la valeur est `undefined` : un champ
     * absent de cette doublure ne paraît pas dans la réponse, donc aucun
     * contrôle portant sur les noms de champs ne peut le voir. Le garde qui
     * refuse un nom d'exercice passait ainsi au vert sur le champ même qu'il
     * existe pour attraper, et celui qui refuse les secrets a le même angle
     * mort pour tout ce qu'on n'a pas posé ici.
     */
    riotId: "Nom#EUW", riotRegion: "euw1", langue: "ja", fuseau: "Europe/Paris",
    sportsHoursPerWeek: 4, pompesMax: 30, pompesMaxLe: new Date("2026-07-01"),
    rappelSeuilSec: 300, plafondQuotidien: 500, variantePompes: "genoux",
    exercicesSuspendus: ["course"],
    santeConsentiLe: new Date("2026-06-02"), santeRefuseLe: null,
    dettePointsDus: 320, detteDepuis: new Date("2026-09-05"),
    paiementEclairLe: new Date("2026-08-20"),
  }));
  (prisma.game.findMany as jest.Mock).mockResolvedValue([
    { id: "g1", userId: "u1", date: new Date(), pompesCalculees: 38, exercice: "pompes" },
  ]);
  (prisma.goal.findUnique as jest.Mock).mockResolvedValue({ objectifTotalPompes: 1000 });
  (prisma.pushSubscription.findMany as jest.Mock).mockResolvedValue([{ createdAt: new Date() }]);
  (prisma.paiement.findMany as jest.Mock).mockResolvedValue([
    { jour: "2026-08-20", points: 42, createdAt: new Date("2026-08-20T21:00:00Z") },
  ]);
  (prisma.signalement.findMany as jest.Mock).mockResolvedValue([
    { createdAt: new Date("2026-07-01"), message: "le chrono saute", page: "/dashboard", statut: "ouvert" },
  ]);
  (prisma.demandeJeu.findMany as jest.Mock).mockResolvedValue([
    { nom: "Dead by Daylight", quand: new Date("2026-09-01") },
  ]);
});

/**
 * L'export sert le droit à la portabilité : il doit être complet. Mais il
 * traverse le réseau et finit dans un fichier sur un disque, donc il ne doit
 * contenir aucun secret. Les deux exigences tirent en sens contraire, et c'est
 * exactement ce que ces tests surveillent.
 */
describe("GET /api/user/export", () => {
  it("refuse sans session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("n'exporte que les données du demandeur", async () => {
    session.mockResolvedValue(utilisateur({ id: "u42" }));
    await GET();
    for (const appel of [
      (prisma.game.findMany as jest.Mock).mock.calls[0][0],
      (prisma.goal.findUnique as jest.Mock).mock.calls[0][0],
      (prisma.pushSubscription.findMany as jest.Mock).mock.calls[0][0],
    ]) {
      expect(JSON.stringify(appel)).toContain("u42");
    }
  });

  it("ne laisse sortir aucun secret", async () => {
    const brut = JSON.stringify(await corps(await GET()));
    for (const secret of ["$2a$empreinte-secrete", "PUUID-SECRET-1234", "sessionEpoch", "passwordHash"]) {
      expect(brut).not.toContain(secret);
    }
  });

  it("inclut les données de santé collectées", async () => {
    // Poids, taille, âge et genre sont collectés à l'inscription. Le droit à
    // la portabilité porte sur eux comme sur le reste.
    const d = await corps(await GET()) as { compte: Record<string, unknown> };
    expect(d.compte.poids).toBe(75);
    expect(d.compte.taille).toBe(180);
    expect(d.compte.age).toBe(27);
    expect(d.compte.genre).toBe("homme");
  });

  it("inclut l'historique des parties", async () => {
    const d = await corps(await GET()) as Record<string, unknown>;
    const brut = JSON.stringify(d);
    expect(brut).toContain("38");
  });

  it("n'expose des abonnements que la date, jamais la clé", async () => {
    // Un abonnement aux notifications porte une clé qui permet d'envoyer un
    // message au navigateur : elle n'a rien à faire dans un fichier exporté.
    await GET();
    const appel = (prisma.pushSubscription.findMany as jest.Mock).mock.calls[0][0];
    expect(Object.keys(appel.select)).toEqual(["createdAt"]);
  });
});

/**
 * Ce que l'export oubliait.
 *
 * Les séances payées manquaient : c'est pourtant la moitié de ce que
 * l'application sait de quelqu'un, et la moitié qu'il a envie de reprendre.
 * Les parties disent ce qu'il a joué, les paiements disent ce qu'il a FAIT.
 */
describe("l'export porte tout ce qui appartient à la personne", () => {
  const lire = async () => corps(await GET());

  it("rend les séances payées, jour par jour", async () => {
    const d = await lire() as { seances: { jour: string; pointsAcquittes: number }[] };
    expect(d.seances).toEqual([
      expect.objectContaining({ jour: "2026-08-20", pointsAcquittes: 42 }),
    ]);
  });

  it("ne lit les séances que du compte courant", async () => {
    await lire();
    expect((prisma.paiement.findMany as jest.Mock).mock.calls[0][0].where.userId)
      .toBe(utilisateur().id);
  });

  /**
   * La phrase de l'écran annonce ce que le fichier contient.
   *
   * Elle disait « ton profil, tes réglages et l'intégralité de tes parties »
   * alors que les séances payées y sont depuis qu'on a complété l'export —
   * c'est-à-dire qu'elle omettait précisément la moitié que la personne a
   * envie de reprendre : les parties disent ce qu'elle a joué, les paiements
   * ce qu'elle a FAIT. Une description périmée ne se distingue pas d'une
   * garantie, et sur un écran de portabilité elle décourage de chercher.
   *
   * Les deux moitiés ensemble : tant que la route rend les séances, la phrase
   * les annonce. Le jour où l'export cesserait d'en rendre, le contrôle
   * changerait de sens et il faudrait reprendre le texte en même temps.
   */
  it("et la phrase de l'écran l'annonce", async () => {
    const d = await lire() as Record<string, unknown>;
    expect(Array.isArray(d.seances)).toBe(true);
    expect(settings.fr.exportAide).toMatch(/séance/i);
  });

  /**
   * Chaque bloc de l'export est ANNONCÉ, ou dit pourquoi il ne l'est pas.
   *
   * La phrase promettait « profil, réglages et parties » quand le fichier en
   * rendait cinq ; on y a ajouté les séances, et le compte a recommencé à
   * dériver à la ligne suivante. Ce contrôle tient les deux moitiés ensemble :
   * un bloc ajouté demain fait tomber le test tant que personne n'a décidé si
   * la phrase doit le nommer.
   *
   * Une dispense n'est pas un oubli toléré : elle dit que le bloc entre dans
   * « tout ce qu'on garde sur toi », qui ouvre la phrase, sans mériter d'être
   * énuméré. L'énumération sert à ce que la personne reconnaisse ce qu'elle
   * vient chercher, pas à faire l'inventaire.
   */
  const ANNONCE: Record<string, RegExp | string> = {
    compte: /profil/i,
    preferences: /réglage/i,
    parties: /partie/i,
    seances: /séance/i,
    exportLe: "l'horodatage du fichier, pas une donnée",
    detteEnAttentePoints: "la dette du moment, que l'écran montre en permanence",
    detteDepuis: "la date de cette dette, avec elle",
    premierPaiementEclairLe: "un badge, pas une donnée qu'on vient reprendre",
    appareilsNotifies: "une date d'abonnement n'est pas ce qu'on vient chercher",
    signalements: "ce qu'on nous a écrit, qu'on avait déjà sous les yeux",
    jeuxDemandes: "un nom de jeu tapé une fois, à côté de ce qui compte",
  };

  it("annonce chaque bloc, ou dit pourquoi il n'est pas énuméré", async () => {
    const d = await lire() as Record<string, unknown>;
    const blocs = Object.keys(d);
    // Sans témoin, un export vidé rendrait le contrôle vert sur zéro bloc.
    expect(blocs.length).toBeGreaterThan(5);

    const inconnus = blocs.filter((b) => !(b in ANNONCE));
    expect(inconnus).toEqual([]);

    const promis = Object.entries(ANNONCE)
      .filter(([b, r]) => r instanceof RegExp && blocs.includes(b))
      .filter(([, r]) => !(r as RegExp).test(settings.fr.exportAide));
    expect(promis).toEqual([]);

    // Et une dispense qui ne désigne plus rien tombe : c'est la règle des
    // autres gardes de ce projet.
    expect(Object.keys(ANNONCE).filter((b) => !blocs.includes(b))).toEqual([]);
  });

  /**
   * Aucun nom de champ ne parle de BOXE.
   *
   * `seuilRappelBoxeSec` a survécu au renommage qui a corrigé le libellé de
   * l'écran : le seuil ne gouvernait que les exercices comptés au temps, et il
   * gouverne toute la dette depuis qu'elle monte pour tous. C'est la moitié
   * non reprise d'une correction déjà faite, et un nom de champ dans un
   * fichier de portabilité est lu par la personne.
   */
  it("et aucun nom de champ ne parle d'un seul exercice", async () => {
    const brut = JSON.stringify(await lire());
    const cles = [...brut.matchAll(/"([A-Za-z][A-Za-z0-9]*)":/g)].map((m) => m[1]);
    expect(cles.length).toBeGreaterThan(20);
    // Les VALEURS peuvent nommer un exercice — « boxe » est un choix légitime
    // dans la liste des exercices sélectionnés. Ce sont les NOMS de champs qui
    // ne doivent désigner aucun exercice en particulier, puisque le réglage
    // qu'ils portent les gouverne tous.
    expect(cles.filter((c) => /boxe/i.test(c))).toEqual([]);
  });

  it("rend ce que la personne nous a écrit", async () => {
    const d = await lire() as { signalements: { message: string }[] };
    expect(d.signalements[0].message).toBe("le chrono saute");
  });

  it("rend la trace du consentement aux données de santé", async () => {
    // C'est à nous de prouver qu'il a été donné : il est normal que la
    // personne reçoive la même preuve.
    session.mockResolvedValue(utilisateur({ santeConsentiLe: new Date("2026-06-02") }));
    const d = await lire() as { compte: Record<string, unknown> };
    expect(d.compte.santeConsentiLe).toBeTruthy();
  });

  it("ne sort pas le jeton de la source de diffusion", async () => {
    // C'est une donnée du compte, mais c'est aussi un laissez-passer : dans un
    // fichier qu'on s'envoie par courriel, ça devient une clé qui traîne.
    session.mockResolvedValue(utilisateur({ jetonObs: "JETON-OBS-SECRET" }));
    expect(JSON.stringify(await lire())).not.toContain("JETON-OBS-SECRET");
  });
});
