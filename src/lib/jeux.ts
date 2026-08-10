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
};

export const JEUX: JeuDef[] = [
  { nom: "League of Legends", type: "parties", riot: true },
  { nom: "Valorant", type: "parties" },
  { nom: "Counter-Strike 2", type: "parties" },
  { nom: "Fortnite", type: "parties" },
  { nom: "Call of Duty", type: "parties" },
  { nom: "Rocket League", type: "parties" },
  { nom: "Teamfight Tactics", type: "parties" },
  { nom: "Minecraft", type: "temps" },
  { nom: "World of Warcraft", type: "temps" },
  { nom: "Grand Theft Auto V", type: "temps" },
  { nom: "Elden Ring", type: "temps" },
  { nom: "Les Sims", type: "temps" },
];

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
