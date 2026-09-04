import {
  avancementNiveau,
  niveauPourPoints,
  PAS_NIVEAU,
  seuilDuNiveau,
  titrePorte,
  TITRES,
  tousLesTitres,
  type SourceNiveau,
} from "@/lib/niveauCompte";

const vide: SourceNiveau = { pointsPayes: 0, parties: 0, meilleureSerie: 0, joursPayes: 0 };
const source = (p: Partial<SourceNiveau>): SourceNiveau => ({ ...vide, ...p });

describe("le niveau de compte", () => {
  it("commence à 1 sans rien avoir payé", () => {
    expect(niveauPourPoints(0)).toBe(1);
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
      if (niveauPourPoints(seuil) !== n || niveauPourPoints(seuil - 1) !== n - 1) ecarts.push(n);
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
      const n = niveauPourPoints(points);
      expect(seuilDuNiveau(n)).toBeLessThanOrEqual(points);
      expect(seuilDuNiveau(n + 1)).toBeGreaterThan(points);
    }
  });

  it("cale sa courbe sur le dernier palier de volume", () => {
    // 25 000 points est le dernier palier de badges : les deux échelles
    // doivent dire la même chose, sinon on affiche deux progressions qui se
    // contredisent sur le même écran.
    expect(niveauPourPoints(25000)).toBe(32);
    expect(seuilDuNiveau(2)).toBe(50);
    expect(seuilDuNiveau(10)).toBe(2250);
  });

  it("écarte ce qui n'est pas un nombre plutôt que de rendre NaN", () => {
    expect(niveauPourPoints(Number.NaN)).toBe(1);
    expect(niveauPourPoints(Number.POSITIVE_INFINITY)).toBe(1);
    expect(niveauPourPoints(-500)).toBe(1);
    expect(avancementNiveau(Number.NaN).part).toBe(0);
  });

  it("rend un avancement borné entre 0 et 1", () => {
    const a = avancementNiveau(seuilDuNiveau(5));
    expect(a.niveau).toBe(5);
    expect(a.part).toBe(0);
    expect(a.restant).toBe(seuilDuNiveau(6) - seuilDuNiveau(5));

    const b = avancementNiveau(seuilDuNiveau(6) - 1);
    expect(b.niveau).toBe(5);
    expect(b.part).toBeGreaterThan(0.9);
    expect(b.part).toBeLessThanOrEqual(1);
    expect(b.restant).toBe(1);
  });

  it("garde le pas déclaré, sans quoi la courbe change en silence", () => {
    expect(PAS_NIVEAU).toBe(25);
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
