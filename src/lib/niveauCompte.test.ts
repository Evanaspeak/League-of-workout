import {
  avancementNiveau,
  avancementPourXp,
  niveauPourXp,
  PAS_NIVEAU,
  seuilDuNiveau,
  titrePorte,
  TITRES,
  tousLesTitres,
  XP_PAR_ACTIVITE,
  xpDuCompte,
  type SourceNiveau,
} from "@/lib/niveauCompte";

const vide: SourceNiveau = { pointsPayes: 0, parties: 0, meilleureSerie: 0, joursPayes: 0 };
const source = (p: Partial<SourceNiveau>): SourceNiveau => ({ ...vide, ...p });

describe("le niveau de compte", () => {
  it("commence à 1 sans rien avoir fait", () => {
    expect(niveauPourXp(0)).toBe(1);
    expect(seuilDuNiveau(1)).toBe(0);
  });

  it("monte exactement AU seuil, jamais un point après, sur 300 000 niveaux", () => {
    /**
     * C'est ce test qui GARANTIT la forme fermée, et pas son commentaire.
     *
     * La crainte était qu'une racine carrée flottante rende 2,9999997 au
     * seuil exact — à l'instant même qu'on fête. Elle ne le fait pas ici,
     * parce qu'au seuil l'argument vaut `(2n − 1)²`, un carré parfait. Mais
     * ça se vérifie plutôt que ça ne se croit : trois cent mille niveaux,
     * chacun éprouvé au seuil ET un point en dessous.
     */
    const ecarts: number[] = [];
    let vus = 0;
    for (let n = 2; n < 300000; n += 1) {
      const seuil = seuilDuNiveau(n);
      vus += 1;
      if (niveauPourXp(seuil) !== n || niveauPourXp(seuil - 1) !== n - 1) ecarts.push(n);
      if (ecarts.length > 4) break;
    }
    expect(ecarts).toEqual([]);
    /**
     * Le témoin COMPTE les tours, il ne rejoue pas un cas.
     *
     * Le premier jet vérifiait un niveau isolé hors de la boucle : vider la
     * boucle laissait le test au vert, puisque la liste d'écarts est vide dans
     * les deux cas et que le cas isolé passait toujours. Un témoin posé à côté
     * de ce qu'il surveille ne surveille rien.
     */
    expect(vus).toBe(299998);
  });

  it("reste cohérent sur des valeurs absurdement grandes", () => {
    // Pas un cas d'usage : un contrôle que le calcul ne se disloque pas hors
    // de son domaine. Le niveau rendu doit encadrer les points, toujours.
    for (const points of [1e12, 1e15, 1e18, 1e30]) {
      const n = niveauPourXp(points);
      expect(seuilDuNiveau(n)).toBeLessThanOrEqual(points);
      expect(seuilDuNiveau(n + 1)).toBeGreaterThan(points);
    }
  });

  /**
   * Les repères donnés par le propriétaire, en ACTIVITÉS et pas en XP.
   *
   * C'est ainsi qu'il a formulé la demande — « niveau un au niveau deux, dix
   * activités, après trente » — donc c'est ainsi que le test doit la tenir. Le
   * jour où l'XP par activité change, c'est ce contrôle qui dira que la
   * promesse faite ne tient plus, là où un seuil écrit en XP ne dirait rien.
   */
  it.each([
    [2, 10],
    [3, 30],
    [4, 60],
    [5, 100],
    [6, 150],
  ])("demande %i activités pour atteindre le niveau %i", (niveau, activites) => {
    const source: SourceNiveau = { ...vide, parties: activites };
    expect(niveauPourXp(xpDuCompte(source))).toBe(niveau);
    // Et une activité de moins ne suffit pas : sans ce second sens, un seuil
    // trop bas passerait le contrôle du dessus.
    expect(niveauPourXp(xpDuCompte({ ...vide, parties: activites - 1 }))).toBe(niveau - 1);
  });

  it("fait monter plus vite celui qui paie", () => {
    // Neuf cent soixante parties jamais payées : le cas réel qui a motivé le
    // changement. Le compteur bouge enfin, ce qu'il ne faisait pas.
    const joue = { ...vide, parties: 960 };
    expect(niveauPourXp(xpDuCompte(joue))).toBeGreaterThan(10);

    // Le même compte qui aurait payé la moitié de ce qu'il doit monte plus
    // haut. C'est ce qui remplace l'ancienne porte : un rapport, pas un mur.
    const paye = { ...joue, pointsPayes: 5000 };
    expect(niveauPourXp(xpDuCompte(paye)))
      .toBeGreaterThan(niveauPourXp(xpDuCompte(joue)));
  });

  it("compte l'activité et le paiement, chacun à son taux", () => {
    expect(xpDuCompte({ ...vide, parties: 3 })).toBe(3 * XP_PAR_ACTIVITE);
    expect(xpDuCompte({ ...vide, pointsPayes: 40 })).toBe(40);
    expect(xpDuCompte({ ...vide, parties: 3, pointsPayes: 40 })).toBe(3 * XP_PAR_ACTIVITE + 40);
    // Une source abîmée vaut zéro plutôt que NaN : NaN traverse une barre de
    // progression sans bruit.
    expect(xpDuCompte({ ...vide, parties: Number.NaN, pointsPayes: -12 })).toBe(0);
  });

  it("écarte ce qui n'est pas un nombre plutôt que de rendre NaN", () => {
    expect(niveauPourXp(Number.NaN)).toBe(1);
    expect(niveauPourXp(Number.POSITIVE_INFINITY)).toBe(1);
    expect(niveauPourXp(-500)).toBe(1);
    expect(avancementPourXp(Number.NaN).part).toBe(0);
    expect(avancementNiveau({ ...vide, parties: Number.NaN }).part).toBe(0);
  });

  it("rend un avancement borné entre 0 et 1", () => {
    const a = avancementPourXp(seuilDuNiveau(5));
    expect(a.niveau).toBe(5);
    expect(a.part).toBe(0);
    expect(a.restant).toBe(seuilDuNiveau(6) - seuilDuNiveau(5));

    const b = avancementPourXp(seuilDuNiveau(6) - 1);
    expect(b.niveau).toBe(5);
    expect(b.part).toBeGreaterThan(0.9);
    expect(b.part).toBeLessThanOrEqual(1);
    expect(b.restant).toBe(1);
  });

  /**
   * Le pas est épinglé, et ce pin a déjà servi : il est tombé le jour où la
   * courbe est passée de l'effort payé à l'XP. C'est ce qu'on lui demande —
   * une courbe de progression ne doit pas pouvoir bouger sans que quelqu'un
   * l'écrive. Le chiffre a changé une fois, avec sa raison ; il ne changera
   * pas deux fois par accident.
   */
  it("garde le pas déclaré, sans quoi la courbe change en silence", () => {
    expect(PAS_NIVEAU).toBe(50);
    expect(seuilDuNiveau(3)).toBe(PAS_NIVEAU * 3 * 2);
  });
});

describe("le titre", () => {
  it("n'en donne AUCUN à qui n'a rien fait", () => {
    // Et surtout pas un titre qui dit qu'il n'a rien fait : il s'affiche
    // devant quelqu'un d'autre.
    expect(titrePorte(vide)).toBeNull();
  });

  it("porte le plus RARE de ceux qu'on a, pas le dernier gagné", () => {
    // Quelqu'un qui a tout : le titre ne doit pas dépendre de l'ordre
    // d'arrivée, sinon il change à chaque partie.
    const tout = source({ parties: 900, joursPayes: 400, meilleureSerie: 90, pointsPayes: 90000 });
    expect(titrePorte(tout)).toBe("machine");
  });

  it("distingue dix jours épars de sept jours d'affilée", () => {
    expect(titrePorte(source({ parties: 3, joursPayes: 10 }))).toBe("repenti");
    expect(titrePorte(source({ parties: 3, joursPayes: 10, meilleureSerie: 7 }))).toBe("regulier");
  });

  it("s'obtient AU seuil et pas un cran plus loin", () => {
    expect(titrePorte(source({ parties: 1 }))).toBe("premierPas");
    expect(titrePorte(source({ parties: 0 }))).toBeNull();
    expect(titrePorte(source({ parties: 1, pointsPayes: 4999 }))).toBe("premierPas");
    expect(titrePorte(source({ parties: 1, pointsPayes: 5000 }))).toBe("endurant");
  });

  it("rend la liste entière dans l'ordre où on les gagne", () => {
    const liste = tousLesTitres(source({ parties: 1, joursPayes: 10 }));
    expect(liste.map((t) => t.cle)).toEqual(TITRES.map((t) => t.cle));
    expect(liste.filter((t) => t.obtenu).map((t) => t.cle)).toEqual(["premierPas", "repenti"]);
  });

  it("garde des seuils croissants en difficulté", () => {
    // Le témoin de l'ordre : chaque titre doit être gagnable sans le
    // suivant. Un ordre qui se croise ferait afficher un titre facile à
    // quelqu'un qui a le rare.
    const paliers: SourceNiveau[] = [
      source({ parties: 1 }),
      source({ parties: 1, joursPayes: 10 }),
      source({ parties: 1, joursPayes: 10, meilleureSerie: 7 }),
      source({ parties: 1, joursPayes: 10, meilleureSerie: 7, pointsPayes: 5000 }),
      source({ parties: 1, joursPayes: 10, meilleureSerie: 30, pointsPayes: 5000 }),
      source({ parties: 1, joursPayes: 10, meilleureSerie: 30, pointsPayes: 25000 }),
    ];
    expect(paliers.map(titrePorte)).toEqual(TITRES.map((t) => t.cle));
  });
});
