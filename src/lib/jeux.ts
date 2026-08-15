/**
 * Catalogue de jeux.
 *
 * Deux façons de générer une dette, selon le jeu :
 *  - « parties » : chaque partie a un résultat et un KDA (League of Legends,
 *    Valorant…), la dette vient de la performance.
 *  - « temps » : pas de victoire ni de défaite (Minecraft, un RPG solo…), la
 *    dette vient du temps passé assis à jouer.
 *
 * La liste sert de suggestions : l'utilisateur peut toujours saisir un jeu
 * absent du catalogue, en précisant lui-même son type.
 */

export type TypeJeu = "parties" | "temps";

export type JeuDef = {
  nom: string;
  type: TypeJeu;
  /** Le suivi automatique via l'API Riot n'existe que pour ce jeu. */
  riot?: boolean;
  /** Le jeu a des lanes / postes assignés. Propre aux MOBA. */
  roles?: boolean;
  /** On choisit un personnage identifié, dont la maîtrise se cumule. */
  champions?: boolean;
  /** La partie produit un score kills / morts / assists. */
  kda?: boolean;
  /**
   * Battle royale : on ne meurt qu'une fois et il n'y a pas de match nul à
   * comparer. Ce qui distingue une partie d'une autre, c'est le classement
   * final et le nombre d'éliminations.
   */
  br?: boolean;
  /**
   * Rocket League : la partie se juge aux buts, arrêts et passes décisives.
   * Aucune de ces trois statistiques ne pénalise — seule la défaite coûte,
   * et ce qu'on a produit la rachète.
   */
  rl?: boolean;
  /** Nombre de joueurs dans une partie, tous modes confondus. */
  joueurs?: number;
  /**
   * Modes d'équipe proposés, en nombre de joueurs par équipe. Le classement
   * porte sur les équipes : en squad de 4 à 100 joueurs, on finit 7e sur 25.
   */
  modes?: number[];
};

export const JEUX: JeuDef[] = [
  { nom: "League of Legends", type: "parties", riot: true, roles: true, champions: true, kda: true },
  { nom: "Valorant", type: "parties", kda: true },
  { nom: "Counter-Strike 2", type: "parties", kda: true },
  { nom: "Fortnite", type: "parties", br: true, joueurs: 100, modes: [1, 2, 3, 4] },
  { nom: "Apex Legends", type: "parties", br: true, joueurs: 60, modes: [1, 2, 3] },
  { nom: "PUBG", type: "parties", br: true, joueurs: 100, modes: [1, 2, 3, 4] },
  { nom: "Call of Duty: Warzone", type: "parties", br: true, joueurs: 150, modes: [1, 2, 3, 4] },
  { nom: "Call of Duty", type: "parties", kda: true },
  // Ni l'un ni l'autre ne se juge au KDA : buts et placement ne s'y ramènent
  // pas. Seul le résultat compte.
  // Rocket League n'a ni mort ni classement : buts, arrêts et passes rachètent
  // une défaite, rien ne la creuse.
  { nom: "Rocket League", type: "parties", rl: true },
  // TFT se joue à huit et se termine par une place de 1 à 8 : c'est un
  // battle royale, avec une seule équipe par joueur.
  { nom: "Teamfight Tactics", type: "parties", br: true, joueurs: 8, modes: [1] },
  { nom: "Minecraft", type: "temps" },
  { nom: "World of Warcraft", type: "temps" },
  { nom: "Grand Theft Auto V", type: "temps" },
  { nom: "Elden Ring", type: "temps" },
  { nom: "Les Sims", type: "temps" },
];

export type CapacitesJeu = {
  roles: boolean;
  champions: boolean;
  kda: boolean;
  br: boolean;
  /** Buts, arrêts et passes décisives à la place du KDA. */
  rl: boolean;
  /** Nombre de joueurs dans une partie de ce jeu. */
  joueurs: number;
  /** Modes d'équipe proposés, en joueurs par équipe. */
  modes: number[];
};

/** Nombre de joueurs retenu quand le jeu n'en précise pas. */
export const JOUEURS_DEFAUT = 100;
export const MODES_DEFAUT = [1, 2, 3, 4];

/**
 * Combien d'équipes s'affrontent dans ce mode : c'est le dénominateur du
 * classement. À 100 joueurs, un squad de 4 oppose 25 équipes.
 */
export function equipesDuMode(joueurs: number, tailleEquipe: number): number {
  return Math.max(2, Math.round(joueurs / Math.max(1, tailleEquipe)));
}

/**
 * Opération inverse : retrouve le mode d'équipe d'une partie déjà enregistrée.
 * C'est le nombre d'équipes qu'on stocke (le classement porte sur elles), pas
 * la taille du groupe. Le résultat est ramené au mode proposé le plus proche
 * pour qu'un arrondi ne crée pas une catégorie parasite à côté de « Trio ».
 */
export function tailleEquipeDepuisEquipes(
  jeu: string | null | undefined,
  equipes: number | null | undefined,
): number | null {
  if (!equipes || equipes <= 0) return null;
  const { joueurs, modes } = capacitesDuJeu(jeu);
  const brut = joueurs / equipes;
  return modes.reduce((meilleur, m) =>
    Math.abs(m - brut) < Math.abs(meilleur - brut) ? m : meilleur,
  );
}

/**
 * Ce que le jeu permet de renseigner. Un jeu saisi librement est traité comme
 * un jeu générique : un résultat, et un KDA s'il en a un — mais ni lane ni
 * champion, qui n'ont de sens que dans un MOBA.
 */
export function capacitesDuJeu(nom: string | null | undefined, typeFourni?: unknown): CapacitesJeu {
  const def = trouverJeu(nom);
  if (def) {
    return {
      roles: !!def.roles,
      champions: !!def.champions,
      // Un battle royale se saisit au classement, pas au KDA.
      kda: !!def.kda && !def.br && !def.rl,
      br: !!def.br,
      rl: !!def.rl,
      joueurs: def.joueurs ?? JOUEURS_DEFAUT,
      modes: def.modes ?? MODES_DEFAUT,
    };
  }
  // Jeu inconnu au catalogue : on suppose un KDA s'il se compte en parties.
  return {
    roles: false,
    champions: false,
    kda: toTypeJeu(typeFourni) === "parties",
    br: false,
    rl: false,
    joueurs: JOUEURS_DEFAUT,
    modes: MODES_DEFAUT,
  };
}

export const JEU_DEFAUT = "League of Legends";

export function isTypeJeu(v: unknown): v is TypeJeu {
  return v === "parties" || v === "temps";
}

export function toTypeJeu(v: unknown): TypeJeu {
  return isTypeJeu(v) ? v : "parties";
}

/** Retrouve un jeu du catalogue par son nom (insensible à la casse). */
export function trouverJeu(nom: string | null | undefined): JeuDef | null {
  if (!nom) return null;
  const cible = nom.trim().toLowerCase();
  return JEUX.find((j) => j.nom.toLowerCase() === cible) ?? null;
}

/**
 * Type d'un jeu : celui du catalogue s'il y figure, sinon celui fourni par
 * l'utilisateur pour un jeu saisi librement.
 */
export function typeDuJeu(nom: string | null | undefined, typeFourni?: unknown): TypeJeu {
  return trouverJeu(nom)?.type ?? toTypeJeu(typeFourni);
}

/**
 * Temps de jeu lisible. Contrairement au temps d'exercice (qui se compte en
 * minutes), une durée de jeu se compte vite en heures : « 720 min » ne parle
 * à personne, « 12 h » si.
 */
export function formaterTempsJeu(totalSecondes: number): string {
  const s = Math.max(0, Math.round(totalSecondes));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, "0")}`;
}

/** Nettoie un nom de jeu saisi librement. */
export function normaliserNomJeu(nom: unknown): string {
  const brut = String(nom ?? "").trim().replace(/\s+/g, " ");
  if (!brut) return JEU_DEFAUT;
  // Un jeu connu garde l'orthographe du catalogue, pour que les statistiques
  // ne se dispersent pas entre « minecraft » et « Minecraft ».
  return trouverJeu(brut)?.nom ?? brut.slice(0, 60);
}
