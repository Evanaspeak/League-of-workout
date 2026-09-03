import {
  decisionDemande,
  normaliserCode,
  nouveauCode,
  successeur,
  validerNomGroupe,
  LONGUEUR_CODE,
  ALPHABET_POUR_TEST,
  MAX_DEMANDES_EN_ATTENTE,
  MAX_MEMBRES,
  MAX_GROUPES,
  NOM_GROUPE_MAX,
} from "./social";

const lien = (demandeurId: string, receveurId: string, etat = "attente", id = "a1") =>
  ({ id, demandeurId, receveurId, etat });

describe("ce qu'une demande d'amitié doit produire", () => {
  it("refuse de s'ajouter soi-même", () => {
    expect(decisionDemande("u1", "u1", [])).toEqual({ quoi: "soi-meme" });
  });

  it("crée quand rien n'existe", () => {
    expect(decisionDemande("u1", "u2", [])).toEqual({ quoi: "creer" });
  });

  it("ne regarde pas les liens des autres couples", () => {
    // Sans le filtre sur le couple, une amitié entre deux tiers ferait croire
    // que celle-ci existe déjà.
    expect(decisionDemande("u1", "u2", [lien("u3", "u4", "acceptee")]))
      .toEqual({ quoi: "creer" });
  });

  it("dit qu'on est déjà amis, dans un sens comme dans l'autre", () => {
    expect(decisionDemande("u1", "u2", [lien("u1", "u2", "acceptee")]))
      .toEqual({ quoi: "deja-amis" });
    expect(decisionDemande("u1", "u2", [lien("u2", "u1", "acceptee")]))
      .toEqual({ quoi: "deja-amis" });
  });

  it("refuse de redemander ce qu'on a déjà demandé", () => {
    expect(decisionDemande("u1", "u2", [lien("u1", "u2")]))
      .toEqual({ quoi: "deja-demande" });
  });

  /**
   * Le cas qui justifie tout le module.
   *
   * L'autre m'a déjà demandé : le demander à mon tour est une ACCEPTATION.
   * Créer une seconde ligne laisserait deux demandes croisées, chacun voyant
   * « en attente de sa réponse » — une amitié que personne ne peut conclure,
   * et rien qui le signale : les deux écrans disent quelque chose de sensé.
   */
  it("accepte au lieu de créer un doublon quand l'autre a déjà demandé", () => {
    expect(decisionDemande("u1", "u2", [lien("u2", "u1", "attente", "x9")]))
      .toEqual({ quoi: "accepter", id: "x9" });
  });

  it("préfère l'acceptation même si les deux lignes existent déjà", () => {
    // L'unicité en base porte sur un couple ORIENTÉ : elle n'empêche pas le
    // doublon inverse, donc le cas est atteignable et se lit dans le bon sens.
    expect(decisionDemande("u1", "u2", [lien("u1", "u2", "attente", "mienne")]))
      .toEqual({ quoi: "deja-demande" });
  });

  it("l'acceptation gagne sur la création même quand un tiers traîne", () => {
    expect(decisionDemande("u1", "u2", [
      lien("u5", "u1", "attente", "autre"),
      lien("u2", "u1", "attente", "bonne"),
    ])).toEqual({ quoi: "accepter", id: "bonne" });
  });
});

describe("le code d'invitation", () => {
  it("fait la bonne longueur", () => {
    expect(nouveauCode()).toHaveLength(LONGUEUR_CODE);
  });

  it("évite les caractères qui se confondent à la lecture", () => {
    // Un code se dicte en vocal avant de se taper. « O » et « 0 » retapés
    // faux n'ouvrent rien, et c'est la seule porte du groupe.
    const tirages = Array.from({ length: 200 }, nouveauCode).join("");
    expect(tirages).not.toMatch(/[O0I1L]/);
    expect(tirages).toMatch(/^[A-Z2-9]+$/);
  });

  it("diffère à chaque tirage", () => {
    const cent = new Set(Array.from({ length: 100 }, nouveauCode));
    expect(cent.size).toBe(100);
  });

  it("emploie tout l'alphabet : aucune lettre inatteignable", () => {
    const lettres = new Set(Array.from({ length: 400 }, () => nouveauCode()).join(""));
    expect(lettres.size).toBe(ALPHABET_POUR_TEST.length);
  });

  /**
   * Le rejet des octets hors borne, éprouvé sur une source posée.
   *
   * Deux cent cinquante-six n'est pas divisible par trente et un : un modulo
   * direct rendrait les huit premières lettres neuf fois contre huit pour les
   * autres. Sur des tirages aléatoires, cet excès de douze pour cent se
   * confond avec le bruit — un test écrit là-dessus passerait des deux côtés,
   * et croirait éprouver quelque chose. Avec les deux cent cinquante-six
   * valeurs posées une fois chacune, la distribution attendue est exacte.
   */
  it("ne favorise aucune lettre : chaque octet hors borne est jeté", () => {
    /**
     * Les huit valeurs à REJETER sont servies en PREMIER, exprès.
     *
     * Servies en dernier, elles ne seraient jamais demandées — le tirage
     * s'arrête dès qu'il a ses huit lettres — et le rejet ne serait pas sur le
     * chemin. Le test passerait alors avec un modulo, c'est-à-dire en
     * n'éprouvant rien.
     *
     * La source rend huit octets quoi qu'on lui demande, pour qu'aucun ne se
     * perde à la fin d'une tranche : le tirage rappelle tant qu'il lui en
     * manque, donc les deux cent cinquante-six valeurs y passent toutes.
     */
    const ordre = [
      ...Array.from({ length: 8 }, (_, i) => 248 + i),
      ...Array.from({ length: 248 }, (_, i) => i),
    ];
    let curseur = 0;
    const source = () => {
      const tranche = Uint8Array.from(ordre.slice(curseur, curseur + 8));
      curseur += 8;
      return tranche;
    };

    const compte = new Map<string, number>();
    // 248 octets retenus sur 256, soit exactement 31 codes de huit lettres.
    for (let i = 0; i < 31; i++) {
      for (const lettre of nouveauCode(source)) {
        compte.set(lettre, (compte.get(lettre) ?? 0) + 1);
      }
    }
    expect(curseur).toBe(256);
    expect(compte.size).toBe(ALPHABET_POUR_TEST.length);
    expect([...new Set(compte.values())]).toEqual([8]);
  });
});

describe("un code tapé à la main", () => {
  it("accepte les minuscules, les espaces et les tirets", () => {
    // On accepte ce que quelqu'un tape réellement. Refuser la présentation,
    // c'est refuser la seule porte du groupe.
    const code = nouveauCode();
    const abime = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `;
    expect(normaliserCode(abime)).toBe(code);
  });

  it("refuse ce qui n'est pas un code", () => {
    expect(normaliserCode(null)).toBeNull();
    expect(normaliserCode(42)).toBeNull();
    expect(normaliserCode("")).toBeNull();
    expect(normaliserCode("ABC")).toBeNull();
    expect(normaliserCode("ABCDEFGHIJ")).toBeNull();
  });

  it("refuse un caractère hors alphabet, même à la bonne longueur", () => {
    // « O » n'est pas dans l'alphabet : l'accepter en le confondant avec zéro
    // serait deviner à la place de quelqu'un.
    expect(normaliserCode("ABCDEFGO")).toBeNull();
    expect(normaliserCode("ABCDEFG!")).toBeNull();
  });
});

describe("le nom d'un groupe", () => {
  it("accepte un nom ordinaire, sans les espaces du bord", () => {
    expect(validerNomGroupe("  Les Bras Cassés  ")).toEqual({ ok: true, valeur: "Les Bras Cassés" });
  });

  it("refuse ce qui n'est pas un texte", () => {
    expect(validerNomGroupe(undefined).ok).toBe(false);
    expect(validerNomGroupe(12).ok).toBe(false);
  });

  it("refuse trop court et trop long", () => {
    expect(validerNomGroupe("a").ok).toBe(false);
    expect(validerNomGroupe("x".repeat(NOM_GROUPE_MAX + 1)).ok).toBe(false);
  });

  it("refuse une balise", () => {
    // C'est du texte que d'autres liront, et personne ne modère cet espace.
    expect(validerNomGroupe("<b>salut</b>").ok).toBe(false);
    expect(validerNomGroupe("a\nb").ok).toBe(false);
  });
});

describe("qui hérite du groupe", () => {
  const m = (userId: string, jours: number, role = "membre") =>
    ({ id: `m-${userId}`, userId, role, createdAt: new Date(2026, 0, jours) });

  it("le plus ancien membre restant", () => {
    // Un groupe sans propriétaire ne peut plus refaire son code : c'est une
    // porte qu'on ne peut plus fermer, et rien ne la répare.
    expect(successeur([m("u1", 1, "proprietaire"), m("u3", 5), m("u2", 2)], "u1"))
      .toEqual({ id: "m-u2" });
  });

  it("personne quand il ne reste personne", () => {
    expect(successeur([m("u1", 1, "proprietaire")], "u1")).toBeNull();
  });

  it("ne désigne jamais celui qui part", () => {
    expect(successeur([m("u1", 9, "proprietaire"), m("u2", 1)], "u1"))
      .toEqual({ id: "m-u2" });
  });
});

describe("les plafonds", () => {
  it("sont assez hauts pour l'usage et assez bas pour gêner un abus", () => {
    // Ce sont eux qui remplacent la modération : personne ne relit ce qui se
    // passe ici, donc la seule protection contre quelqu'un qui demanderait
    // tout le monde est de rendre la chose impossible.
    expect(MAX_DEMANDES_EN_ATTENTE).toBeGreaterThan(4);
    expect(MAX_DEMANDES_EN_ATTENTE).toBeLessThan(100);
    expect(MAX_MEMBRES).toBeGreaterThan(4);
    expect(MAX_GROUPES).toBeGreaterThan(1);
  });
});
