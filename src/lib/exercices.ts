/**
 * Exercices et conversion d'effort.
 *
 * Toute la base de calcul du scoring reste exprimée en POINTS D'EFFORT, où
 * 1 point = 1 pompe (c'est l'historique du projet : le champ Prisma
 * `Game.pompesCalculees` stocke ces points). Chaque exercice définit combien
 * d'unités (répétitions ou secondes) coûte 1 point, ce qui permet de changer
 * d'exercice sans toucher au moteur de scoring.
 *
 * Le gainage n'est PAS un exercice ici : il sert uniquement de test de
 * calibrage pour déterminer le niveau (1 à 5) de l'utilisateur.
 */

export type ExerciceId = "pompes" | "squats" | "boxe";

export type UniteExercice = "reps" | "temps";

export type ExerciceDef = {
  id: ExerciceId;
  /** Unités par point d'effort (1 point = 1 pompe). */
  ratio: number;
  unite: UniteExercice;
  /** Pas d'arrondi de la quantité affichée (évite « 2 min 51 »). */
  pas: number;
};

export const EXERCICES: Record<ExerciceId, ExerciceDef> = {
  // Référence historique : 1 pompe = 1 point d'effort.
  pompes: { id: "pompes", ratio: 1, unite: "reps", pas: 1 },
  // Les jambes encaissent plus de répétitions que le haut du corps.
  squats: { id: "squats", ratio: 1.5, unite: "reps", pas: 1 },
  // Sac ou shadow : cardio soutenu, compté en temps de travail effectif.
  boxe: { id: "boxe", ratio: 7, unite: "temps", pas: 5 },
};

export const EXERCICE_IDS = Object.keys(EXERCICES) as ExerciceId[];

export const EXERCICE_DEFAUT: ExerciceId = "pompes";

/** Seuil de rappel par défaut, en points d'effort (≈ 5 min de boxe). */
export const RAPPEL_SEUIL_DEFAUT = 45;

/** Seuils proposés dans les réglages, exprimés en points d'effort. 0 = désactivé. */
export const RAPPEL_SEUILS = [0, 45, 90, 135] as const;

export function isExerciceId(v: unknown): v is ExerciceId {
  return typeof v === "string" && v in EXERCICES;
}

/** Normalise une valeur venue de la base ou d'un formulaire. */
export function toExerciceId(v: unknown): ExerciceId {
  return isExerciceId(v) ? v : EXERCICE_DEFAUT;
}

/**
 * Convertit des points d'effort en quantité concrète pour l'exercice donné :
 * un nombre de répétitions, ou un nombre de secondes.
 */
export function quantite(points: number, exercice: ExerciceId): number {
  const def = EXERCICES[exercice];
  const brut = Math.max(0, points) * def.ratio;
  return Math.round(brut / def.pas) * def.pas;
}

/** Formate une durée en secondes : 45 → « 45 s », 850 → « 14 min 10 ». */
export function formaterDuree(totalSecondes: number): string {
  const s = Math.max(0, Math.round(totalSecondes));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  const reste = s % 60;
  if (reste === 0) return `${minutes} min`;
  return `${minutes} min ${String(reste).padStart(2, "0")}`;
}

/**
 * Valeur compacte, sans nom d'exercice — pour les tableaux et les compteurs.
 * Reps → « 38 ». Temps → « 4 min 26 ».
 */
export function formaterCompact(points: number, exercice: ExerciceId): string {
  const q = quantite(points, exercice);
  return EXERCICES[exercice].unite === "temps" ? formaterDuree(q) : String(q);
}

/**
 * Format court pour les axes de graphique, où la place est comptée :
 * les durées sont arrondies à la minute au-delà d'une minute.
 */
export function formaterAxe(points: number, exercice: ExerciceId): string {
  const q = quantite(points, exercice);
  if (EXERCICES[exercice].unite !== "temps") return String(q);
  if (q < 60) return `${q}s`;
  return `${Math.round(q / 60)} min`;
}
