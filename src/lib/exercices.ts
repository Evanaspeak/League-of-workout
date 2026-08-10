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
  /**
   * Secondes de travail pour une répétition, micro-repos compris. Sert à
   * exprimer une dette en temps d'effort, seule unité commune à tous les
   * exercices. Absent pour un exercice déjà compté en temps : son `ratio`
   * donne directement des secondes.
   */
  secondesParRep?: number;
};

export const EXERCICES: Record<ExerciceId, ExerciceDef> = {
  // Référence historique : 1 pompe = 1 point d'effort.
  pompes: { id: "pompes", ratio: 1, unite: "reps", pas: 1, secondesParRep: 6 },
  // Les jambes encaissent plus de répétitions que le haut du corps.
  squats: { id: "squats", ratio: 1.5, unite: "reps", pas: 1, secondesParRep: 5 },
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
 * Normalise une sélection d'exercices : filtre les valeurs inconnues, retire
 * les doublons, conserve l'ordre de la liste de référence et garantit qu'au
 * moins un exercice reste sélectionné.
 */
export function toExerciceIds(v: unknown): ExerciceId[] {
  const bruts = Array.isArray(v) ? v : [v];
  const valides = EXERCICE_IDS.filter((id) => bruts.includes(id));
  return valides.length > 0 ? valides : [EXERCICE_DEFAUT];
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
 * Décompose un total de points par exercice en valeurs affichables. Chaque
 * exercice garde son unité : additionner des répétitions et des secondes pour
 * n'afficher qu'un seul nombre donnerait un résultat faux.
 */
export function ventiler(
  parExercice: Record<string, number>,
): { id: ExerciceId; points: number; valeur: string }[] {
  return EXERCICE_IDS
    .filter((id) => (parExercice[id] ?? 0) > 0)
    .map((id) => ({
      id,
      points: parExercice[id],
      valeur: formaterCompact(parExercice[id], id),
    }));
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

/**
 * Répartit une quantité entière en `n` parts dont la somme reste exacte : les
 * premières parts absorbent le reste de la division. Sert à découper une
 * session de jeu entre plusieurs exercices sans perdre ni inventer de secondes.
 */
export function repartir(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const reste = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0));
}

/**
 * Ventilation de la dette d'une activité entre plusieurs exercices.
 * `{ pompes: 23, boxe: 23 }` : la somme vaut toujours le coût total.
 */
export type Repartition = Partial<Record<ExerciceId, number>>;

/**
 * Découpe un coût entre les exercices retenus, à parts égales. La somme reste
 * exacte : les premières parts absorbent le reste de la division.
 */
export function repartirPoints(total: number, exercices: ExerciceId[]): Repartition {
  const liste = toExerciceIds(exercices);
  const parts = repartir(Math.max(0, Math.round(total)), liste.length);
  const out: Repartition = {};
  liste.forEach((id, i) => { out[id] = parts[i]; });
  return out;
}

/**
 * Relit la ventilation stockée en base. Les lignes créées avant la
 * répartition — ou celles qui ne concernent qu'un exercice — n'en ont pas :
 * tout le coût revient alors à leur exercice unique.
 */
export function parseRepartition(
  brut: unknown,
  exercice: unknown,
  total: number,
): Repartition {
  if (typeof brut === "string" && brut.length > 0) {
    try {
      const objet = JSON.parse(brut) as Record<string, unknown>;
      const out: Repartition = {};
      for (const [cle, valeur] of Object.entries(objet)) {
        if (isExerciceId(cle) && typeof valeur === "number" && valeur >= 0) out[cle] = valeur;
      }
      if (Object.keys(out).length > 0) return out;
    } catch { /* ventilation illisible : on retombe sur l'exercice unique */ }
  }
  return { [toExerciceId(exercice)]: Math.max(0, Math.round(total)) };
}

/** Part revenant à un exercice donné dans une ventilation. */
export function partPourExercice(repartition: Repartition, exercice: ExerciceId): number {
  return repartition[exercice] ?? 0;
}


/** Secondes de travail que représente un point d'effort, pour cet exercice. */
export function secondesParPoint(exercice: ExerciceId): number {
  const def = EXERCICES[exercice];
  // Un exercice compté en temps donne déjà des secondes par point.
  if (def.unite === "temps") return def.ratio;
  return def.ratio * (def.secondesParRep ?? 0);
}

/**
 * Durée totale d'effort que représente une dette, une fois partagée entre les
 * exercices retenus. C'est la seule façon de comparer 20 pompes et 2 min de
 * boxe : on les ramène au temps qu'il faut pour les faire.
 */
export function dureeEffort(points: number, exercices: ExerciceId[]): number {
  const parts = repartirPoints(points, exercices);
  return Object.entries(parts).reduce(
    (total, [id, pts]) => total + (pts ?? 0) * secondesParPoint(toExerciceId(id)),
    0,
  );
}

/**
 * Un exercice se compte-t-il en temps ? Cette distinction commande le
 * compteur d'attente : des pompes se font tout de suite, à la fin de la
 * partie ; de la boxe ne vaut la peine qu'une fois quelques minutes cumulées.
 */
export function estEnTemps(exercice: ExerciceId): boolean {
  return EXERCICES[exercice].unite === "temps";
}

/** Ne garde que les exercices comptés en temps. */
export function exercicesEnTemps(exercices: ExerciceId[]): ExerciceId[] {
  return toExerciceIds(exercices).filter(estEnTemps);
}

/**
 * Part d'une ventilation qui revient à des exercices comptés en temps —
 * la seule qui s'accumule au lieu d'être faite dans la foulée.
 */
export function pointsEnTemps(repartition: Repartition): number {
  return Object.entries(repartition).reduce(
    (total, [id, pts]) => total + (estEnTemps(toExerciceId(id)) ? (pts ?? 0) : 0),
    0,
  );
}
