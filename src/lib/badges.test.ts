import {
  PALIERS_VOLUME, paliersFranchis, prochainPalier, tousLesBadges, type SourceBadges,
} from "./badges";

const source = (champs: Partial<SourceBadges> = {}): SourceBadges => ({
  totalPoints: 0, parties: 0, meilleureSerie: 0, joursPayes: 0, ...champs,
});

describe("badges", () => {
  it("marque obtenu ce qui est atteint, et pas le reste", () => {
    const badges = tousLesBadges(source({ totalPoints: 600 }));
    expect(badges.find((b) => b.cle === "volume500")?.obtenu).toBe(true);
    expect(badges.find((b) => b.cle === "volume1000")?.obtenu).toBe(false);
  });

  it("borne l'avancement au seuil", () => {
    // Un avancement qui dépasse le seuil rendrait une barre de progression à
    // 340 %.
    const badges = tousLesBadges(source({ totalPoints: 99_999 }));
    for (const b of badges) expect(b.avancement).toBeLessThanOrEqual(b.seuil);
  });

  it("ne rend jamais d'avancement négatif", () => {
    const badges = tousLesBadges(source({ totalPoints: -50, parties: -3 }));
    for (const b of badges) expect(b.avancement).toBeGreaterThanOrEqual(0);
  });

  it("donne le premier palier de parties dès la première", () => {
    expect(tousLesBadges(source({ parties: 1 })).find((b) => b.cle === "parties1")?.obtenu)
      .toBe(true);
  });
});

describe("prochain palier", () => {
  it("prend celui dont il reste le moins à faire, en proportion", () => {
    // Sans la proportion, on annoncerait toujours le palier de parties, le
    // plus facile en valeur absolue mais pas le plus proche.
    const p = prochainPalier(source({ totalPoints: 480, parties: 2, meilleureSerie: 0 }));
    expect(p?.cle).toBe("volume500");
  });

  it("ne rend rien quand tout est obtenu", () => {
    const tout = source({
      totalPoints: 1_000_000, parties: 10_000, meilleureSerie: 365, joursPayes: 365,
    });
    expect(prochainPalier(tout)).toBeNull();
  });

  it("rend un palier même à zéro partout", () => {
    expect(prochainPalier(source())).not.toBeNull();
  });
});

describe("franchissement", () => {
  it("ne signale que ce qui vient d'être atteint", () => {
    const avant = source({ totalPoints: 90 });
    const apres = source({ totalPoints: 120 });
    const franchis = paliersFranchis(avant, apres);
    expect(franchis.map((b) => b.cle)).toEqual(["volume100"]);
  });

  it("ne signale rien quand rien n'a changé", () => {
    const etat = source({ totalPoints: 600, parties: 30 });
    expect(paliersFranchis(etat, etat)).toEqual([]);
  });

  it("ne réannonce pas un palier reperdu puis réatteint", () => {
    // Une partie supprimée fait redescendre le total. Le palier ne doit pas se
    // réannoncer au prochain passage : il a déjà été fêté.
    const haut = source({ totalPoints: 600 });
    const bas = source({ totalPoints: 400 });
    expect(paliersFranchis(haut, bas)).toEqual([]);
    expect(paliersFranchis(haut, haut)).toEqual([]);
  });

  it("peut en signaler plusieurs d'un coup", () => {
    const franchis = paliersFranchis(source(), source({ totalPoints: 1200, parties: 30 }));
    const cles = franchis.map((b) => b.cle);
    expect(cles).toContain("volume100");
    expect(cles).toContain("volume1000");
    expect(cles).toContain("parties25");
  });
});

describe("paliers de volume", () => {
  it("montent, sans doublon", () => {
    // Un palier qu'on atteint sans s'en rendre compte ne récompense rien :
    // l'écart entre deux paliers fait le travail.
    for (let i = 1; i < PALIERS_VOLUME.length; i += 1) {
      expect(PALIERS_VOLUME[i]).toBeGreaterThan(PALIERS_VOLUME[i - 1]);
    }
  });
});
