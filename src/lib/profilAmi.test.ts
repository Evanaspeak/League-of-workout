import {
  composerProfil, PARTAGE_DEFAUT, PARTAGES, toPartage,
} from "@/lib/profilAmi";

const TOTAL = { pseudo: "Alice", points: 120, enRetard: false, joursDeRetard: 0 };
const DETAIL = {
  parties: 42, serie: 3, meilleureSerie: 9, jeuFavori: "League of Legends",
  niveau: 12, titre: "regulier",
};

describe("le réglage de partage", () => {
  /**
   * Le défaut est le plus fermé : quelqu'un qui n'ouvre jamais ses réglages ne
   * doit pas se mettre à partager davantage parce qu'on a ajouté quelque
   * chose.
   */
  it("retombe sur le total pour toute valeur inconnue", () => {
    for (const brut of [undefined, null, "", "detaille", "DETAIL", 42, {}, ["detail"]]) {
      expect(toPartage(brut)).toBe("total");
    }
    expect(PARTAGE_DEFAUT).toBe("total");
  });

  it("accepte les deux valeurs prévues, et elles seules", () => {
    expect(PARTAGES).toEqual(["total", "detail"]);
    expect(toPartage("total")).toBe("total");
    expect(toPartage("detail")).toBe("detail");
  });
});

describe("ce qui repart", () => {
  it("au total, le détail n'est pas dans la réponse — même pas vide", () => {
    const p = composerProfil("total", TOTAL, DETAIL);
    expect(Object.keys(p).sort())
      .toEqual(["enRetard", "joursDeRetard", "partage", "points", "pseudo"]);
  });

  it("au détail, tout est là", () => {
    const p = composerProfil("detail", TOTAL, DETAIL);
    expect(p).toEqual({ partage: "detail", ...TOTAL, ...DETAIL });
  });

  /**
   * Le témoin : sans lui, une fonction qui ne rendrait JAMAIS le détail
   * passerait le contrôle ci-dessus en ne prouvant rien.
   */
  it("les deux réponses diffèrent réellement", () => {
    const a = Object.keys(composerProfil("total", TOTAL, DETAIL));
    const b = Object.keys(composerProfil("detail", TOTAL, DETAIL));
    expect(b.length).toBeGreaterThan(a.length);
  });

  /**
   * Le titre est un RÉSUMÉ du détail, donc il en fait partie.
   *
   * « Increvable » dit une série de trente jours — le chiffre même que le
   * mode « total » existe pour taire. Le laisser passer serait défaire le
   * réglage par une porte plus discrète, et personne ne s'en apercevrait :
   * le titre fait un mot et il est flatteur.
   */
  it("le titre et le niveau ne sortent JAMAIS en mode total", () => {
    const p = composerProfil("total", TOTAL, DETAIL);
    expect(p).not.toHaveProperty("titre");
    expect(p).not.toHaveProperty("niveau");
    // Le témoin : ils sortent bien quand la personne l'autorise, sinon le
    // contrôle ci-dessus serait vrai d'une fonction qui ne les rend jamais.
    const q = composerProfil("detail", TOTAL, DETAIL);
    expect(q).toMatchObject({ titre: "regulier", niveau: 12 });
  });

  it("le retard voyage dans les deux cas : c'est ce que le classement montre déjà", () => {
    const enRetard = { ...TOTAL, enRetard: true, joursDeRetard: 5 };
    for (const partage of PARTAGES) {
      const p = composerProfil(partage, enRetard, DETAIL);
      expect({ enRetard: p.enRetard, jours: p.joursDeRetard })
        .toEqual({ enRetard: true, jours: 5 });
    }
  });
});
