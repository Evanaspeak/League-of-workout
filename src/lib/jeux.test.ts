import {
  JEUX, capacitesDuJeu, equipesDuMode, tailleEquipeDepuisEquipes,
  toTypeJeu, typeDuJeu, formaterTempsJeu, JEU_DEFAUT,
} from "./jeux";

/**
 * Le catalogue décide ce que chaque écran a le droit de demander au joueur.
 * Une capacité mal déclarée fait réapparaître un champ champion sur
 * Counter-Strike ou un winrate sur une soirée Minecraft.
 */

// ── Invariant 2 : le mode d'équipe se retrouve exactement ──────────────────

describe("l'aller-retour sur le mode d'équipe", () => {
  const battleRoyales = JEUX.filter((j) => j.br);

  test("le catalogue contient bien des battle royale à tester", () => {
    expect(battleRoyales.length).toBeGreaterThan(0);
  });

  test("chaque mode de chaque battle royale se retrouve depuis le nombre d'équipes", () => {
    for (const jeu of battleRoyales) {
      const { joueurs, modes } = capacitesDuJeu(jeu.nom);
      for (const taille of modes) {
        const equipes = equipesDuMode(joueurs, taille);
        expect(tailleEquipeDepuisEquipes(jeu.nom, equipes)).toBe(taille);
      }
    }
  });

  test("un nombre d'équipes absent ou absurde ne rend pas de mode", () => {
    expect(tailleEquipeDepuisEquipes("Fortnite", null)).toBeNull();
    expect(tailleEquipeDepuisEquipes("Fortnite", 0)).toBeNull();
    expect(tailleEquipeDepuisEquipes("Fortnite", -3)).toBeNull();
  });

  test("le mode retrouvé fait toujours partie de ceux que le jeu propose", () => {
    for (const jeu of battleRoyales) {
      const { modes } = capacitesDuJeu(jeu.nom);
      for (let equipes = 2; equipes <= 200; equipes++) {
        const taille = tailleEquipeDepuisEquipes(jeu.nom, equipes);
        expect(modes).toContain(taille);
      }
    }
  });

  test("il y a toujours au moins deux équipes : on ne joue pas seul", () => {
    expect(equipesDuMode(100, 100)).toBe(2);
    expect(equipesDuMode(100, 999)).toBe(2);
  });
});

// ── Ce que chaque jeu a le droit de demander ───────────────────────────────

describe("les capacités déclarées par le catalogue", () => {
  test("League a rôles, champions et KDA", () => {
    const c = capacitesDuJeu("League of Legends");
    expect(c).toMatchObject({ roles: true, champions: true, kda: true, br: false });
  });

  test("Counter-Strike a un KDA mais ni rôle ni champion", () => {
    const c = capacitesDuJeu("Counter-Strike 2");
    expect(c).toMatchObject({ roles: false, champions: false, kda: true, br: false });
  });

  test("un battle royale n'a jamais de KDA : c'est le classement qui compte", () => {
    for (const jeu of JEUX.filter((j) => j.br)) {
      const c = capacitesDuJeu(jeu.nom);
      expect(c.br).toBe(true);
      expect(c.kda).toBe(false);
    }
  });

  test("aucun jeu n'a de champion sans avoir de rôle", () => {
    for (const jeu of JEUX) {
      const c = capacitesDuJeu(jeu.nom);
      if (c.champions) expect(c.roles).toBe(true);
    }
  });

  test("un jeu inconnu saisi librement n'a ni rôle ni champion", () => {
    const c = capacitesDuJeu("Un jeu que personne ne connaît", "parties");
    expect(c).toMatchObject({ roles: false, champions: false, br: false });
    expect(c.kda).toBe(true);
  });

  test("un jeu au temps n'a rien à demander de compétitif", () => {
    const c = capacitesDuJeu("Minecraft");
    expect(c).toMatchObject({ roles: false, champions: false, kda: false, br: false });
  });
});

// ── Type de jeu ────────────────────────────────────────────────────────────

describe("le type d'un jeu", () => {
  test("Minecraft se compte au temps, League en parties", () => {
    expect(typeDuJeu("Minecraft")).toBe("temps");
    expect(typeDuJeu("League of Legends")).toBe("parties");
  });

  test("une valeur inconnue venue de la base retombe sur « parties »", () => {
    expect(toTypeJeu("n'importe quoi")).toBe("parties");
    expect(toTypeJeu(null)).toBe("parties");
    expect(toTypeJeu(undefined)).toBe("parties");
    expect(toTypeJeu("temps")).toBe("temps");
  });

  test("le jeu par défaut existe bien au catalogue", () => {
    expect(JEUX.some((j) => j.nom === JEU_DEFAUT)).toBe(true);
  });
});

// ── Affichage du temps de jeu ──────────────────────────────────────────────

describe("le formatage du temps de jeu", () => {
  test("les durées courantes s'écrivent lisiblement", () => {
    expect(formaterTempsJeu(0)).toBe("0 s");
    expect(formaterTempsJeu(3600)).toBe("1 h");
    expect(formaterTempsJeu(12300)).toBe("3 h 25");
  });

  test("une durée négative retombe à zéro, jamais sur un signe moins", () => {
    expect(formaterTempsJeu(-500)).toBe("0 s");
    expect(formaterTempsJeu(-500)).not.toContain("-");
  });
});
