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

export type ExerciceId =
  | "pompes" | "squats" | "boxe"
  | "planche" | "tractions" | "course";

export type UniteExercice = "reps" | "temps" | "distance";

/**
 * Groupe travaillé, pour qu'une rotation évite trois jours de pectoraux
 * d'affilée. Le champ existe avant l'écran qui s'en servira : le renseigner
 * plus tard supposerait de rouvrir six définitions et d'en oublier une.
 */
export type GroupeMusculaire = "haut" | "bas" | "tronc" | "cardio";

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
  /** Ce qu'il travaille. */
  groupe: GroupeMusculaire;
  /**
   * Demande-t-il du matériel ?
   *
   * Les tractions supposent une barre, et la corde une corde. Le dire évite
   * qu'on choisisse un exercice qu'on ne pourra pas faire, et découvre le
   * problème une fois la dette due.
   */
  materiel: boolean;
};

/**
 * Ratios livrés avec l'application. Ils servent de valeur de repli quand
 * l'administration n'en a défini aucun, et de borne de retour au défaut.
 */
export const RATIOS_DEFAUT: Record<ExerciceId, number> = {
  pompes: 1,
  squats: 1.5,
  boxe: 7,
  // Le gainage tenu coûte moins qu'un round de sac à la seconde : cinq
  // secondes de planche valent un point.
  planche: 5,
  // Une traction vaut cinq points. Le premier réglage en donnait quarante pour
  // cent points : c'est le contraire de ce qu'on veut, puisque l'exercice est
  // le plus exigeant du lot. Vingt tractions pour cent points, soit à peu près
  // le même temps que cent pompes une fois les repos comptés.
  tractions: 0.2,
  // Vingt mètres par point. Cent points font deux kilomètres, soit à peu près
  // le temps que demandent cent pompes une fois les repos comptés.
  course: 0.02,
};

export const EXERCICES: Record<ExerciceId, ExerciceDef> = {
  // Référence historique : 1 pompe = 1 point d'effort.
  pompes: { id: "pompes", ratio: RATIOS_DEFAUT.pompes, unite: "reps", pas: 1, secondesParRep: 6, groupe: "haut", materiel: false },
  // Les jambes encaissent plus de répétitions que le haut du corps.
  squats: { id: "squats", ratio: RATIOS_DEFAUT.squats, unite: "reps", pas: 1, secondesParRep: 5, groupe: "bas", materiel: false },
  // Sac ou shadow : cardio soutenu, compté en temps de travail effectif.
  boxe: { id: "boxe", ratio: RATIOS_DEFAUT.boxe, unite: "temps", pas: 5, groupe: "cardio", materiel: false },
  // Gainage tenu, compté en secondes. Le même mouvement sert de test de force
  // pour les comptes qui n'ont pas encore fait le test de pompes.
  planche: { id: "planche", ratio: RATIOS_DEFAUT.planche, unite: "temps", pas: 5, groupe: "tronc", materiel: false },
  // Barre nécessaire, et c'est dit : découvrir qu'on ne peut pas faire son
  // exercice une fois la dette due est la pire façon de l'apprendre.
  tractions: { id: "tractions", ratio: RATIOS_DEFAUT.tractions, unite: "reps", pas: 1, secondesParRep: 20, groupe: "haut", materiel: true },
  // Course, en kilomètres. Le pas de cent mètres évite d'afficher « 1,37 km ».
  course: { id: "course", ratio: RATIOS_DEFAUT.course, unite: "distance", pas: 0.1, secondesParRep: 360, groupe: "cardio", materiel: false },
};

export const EXERCICE_IDS = Object.keys(EXERCICES) as ExerciceId[];

/**
 * Exercices dont le ratio se règle depuis l'administration.
 *
 * Les pompes n'en sont pas, et c'est volontaire : le point d'effort EST la
 * pompe. `Game.pompesCalculees` stocke des points depuis le premier jour, et
 * changer ce ratio-là relirait tout l'historique dans une autre unité sans
 * qu'aucun écran ne le dise. Régler les deux autres par rapport aux pompes
 * donne exactement le même pouvoir de réglage, en gardant une référence fixe.
 */
export const EXERCICES_REGLABLES: ExerciceId[] = ["squats", "boxe", "planche", "tractions", "course"];

/**
 * Bornes acceptées pour chaque ratio. Elles ne sont pas décoratives : un
 * ratio nul ferait disparaître la dette, un ratio négatif la rendrait
 * négative, et une valeur démesurée transformerait une défaite en punition
 * intenable. La validation vit ici, donc elle s'applique aussi bien à la
 * saisie de l'administration qu'à une valeur déjà en base.
 */
export const RATIO_BORNES: Record<ExerciceId, { min: number; max: number }> = {
  pompes: { min: 1, max: 1 },
  squats: { min: 0.2, max: 10 },
  boxe: { min: 1, max: 60 },
  planche: { min: 1, max: 60 },
  tractions: { min: 0.05, max: 1 },
  // Cinq mètres par point au minimum, deux cents au maximum : en deçà la
  // course devient un marathon, au-delà elle efface la dette.
  course: { min: 0.005, max: 0.2 },
};

/** Ratios tels qu'ils circulent entre la base, le serveur et le navigateur. */
export type RatiosExercices = Record<ExerciceId, number>;

/**
 * Ramène une valeur quelconque à un jeu de ratios utilisable : complet,
 * numérique, et dans les bornes. Tout ce qui manque ou déraille retombe sur
 * le défaut, exercice par exercice — une valeur illisible pour la boxe ne doit
 * pas emporter celle des squats.
 */
export function normaliserRatios(brut: unknown): RatiosExercices {
  const objet = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const out = { ...RATIOS_DEFAUT };
  for (const id of EXERCICE_IDS) {
    const v = Number(objet[id]);
    if (!Number.isFinite(v)) continue;
    const { min, max } = RATIO_BORNES[id];
    out[id] = Math.min(max, Math.max(min, v));
  }
  return out;
}

/**
 * Installe les ratios pour tout le processus.
 *
 * La conversion points → répétitions est appelée depuis une dizaine d'écrans
 * par des fonctions synchrones ; leur passer la configuration en argument
 * aurait voulu dire modifier chaque appel. Les ratios étant globaux — les
 * mêmes pour tout le monde, pas un réglage par compte — les poser sur le
 * module donne le même résultat sans propager un paramètre partout.
 *
 * Idempotent, et sans état à réinitialiser : appeler deux fois avec la même
 * valeur ne change rien.
 */
export function appliquerRatios(valeurs: unknown): RatiosExercices {
  const ratios = normaliserRatios(valeurs);
  for (const id of EXERCICE_IDS) EXERCICES[id].ratio = ratios[id];
  return ratios;
}

/** Ratios actuellement en vigueur, tels que les conversions les utilisent. */
export function ratiosActuels(): RatiosExercices {
  const out = {} as RatiosExercices;
  for (const id of EXERCICE_IDS) out[id] = EXERCICES[id].ratio;
  return out;
}

export const EXERCICE_DEFAUT: ExerciceId = "pompes";

/** Seuil de rappel par défaut, en points d'effort (≈ 5 min de boxe). */
export const RAPPEL_SEUIL_DEFAUT = 45;

/**
 * Paliers proposés pour le compteur de boxe, en SECONDES d'effort. C'est la
 * seule unité comparable entre exercices, et celle que le compteur affiche.
 * 0 désactive le rappel.
 */
export const RAPPEL_SEUILS_SEC = [0, 120, 300, 600, 900] as const;
export const RAPPEL_SEUIL_SEC_DEFAUT = 300;

/**
 * Paliers proposés pour l'avertissement de volume quotidien, en points
 * d'effort. 0 le désactive. Ce n'est jamais une limite dure : la dette reste
 * due, on signale seulement qu'on a dépassé ce qu'on s'était fixé.
 */
export const PLAFONDS_QUOTIDIENS = [0, 100, 200, 300, 500] as const;

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
 * Le ratio à employer pour cet exercice.
 *
 * Sans jeu de ratios explicite, c'est celui en vigueur MAINTENANT. C'est ce
 * qu'il faut pour un aperçu, un compteur, un simulateur — tout ce qui parle du
 * présent. Ce n'est PAS ce qu'il faut pour une partie déjà enregistrée : elle
 * a été chiffrée sous un barème, et ce barème est le sien pour toujours.
 */
function ratioDe(exercice: ExerciceId, ratios?: RatiosExercices | null): number {
  const r = ratios?.[exercice];
  return typeof r === "number" && Number.isFinite(r) ? r : EXERCICES[exercice].ratio;
}

/**
 * Convertit des points d'effort en quantité concrète pour l'exercice donné :
 * un nombre de répétitions, ou un nombre de secondes.
 *
 * `ratios` gèle la conversion sur un barème donné. Une partie passée porte le
 * sien : sans lui, changer le prix d'une seconde de boxe réécrivait tout
 * l'historique — une soirée qui avait coûté 4 min 25 en affichait 8 min 50, et
 * l'effort déjà fait ne correspondait plus à rien.
 */
export function quantite(points: number, exercice: ExerciceId, ratios?: RatiosExercices | null): number {
  const def = EXERCICES[exercice];
  const brut = Math.max(0, points) * ratioDe(exercice, ratios);
  const arrondi = Math.round(brut / def.pas) * def.pas;
  /**
   * Un pas décimal laisse traîner les flottants : 3 × 0,1 vaut
   * 0,30000000000000004, et la distance s'afficherait ainsi. On recale sur le
   * nombre de décimales du pas lui-même.
   */
  if (!Number.isInteger(def.pas)) {
    const decimales = String(def.pas).split(".")[1]?.length ?? 1;
    return Number(arrondi.toFixed(decimales));
  }
  return arrondi;
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
export function formaterCompact(points: number, exercice: ExerciceId, ratios?: RatiosExercices | null): string {
  return formaterQuantite(quantite(points, exercice, ratios), exercice);
}

/**
 * Met en forme une quantité DÉJÀ convertie : des répétitions, des secondes,
 * des kilomètres.
 *
 * Elle existe pour les cumuls. Un total qui court sur plusieurs parties ne
 * peut pas se convertir d'un coup : chaque partie porte le barème sous lequel
 * elle a été chiffrée, et les additionner en points reviendrait à reconvertir
 * l'ensemble au barème du jour — c'est-à-dire à refaire exactement ce qu'on
 * corrige. On convertit donc partie par partie, puis on additionne des
 * quantités.
 */
export function formaterQuantite(q: number, exercice: ExerciceId): string {
  const unite = EXERCICES[exercice].unite;
  if (unite === "temps") return formaterDuree(q);
  // La distance porte son unité : « 2,4 » seul ne dit pas des kilomètres, et
  // c'est le seul exercice dont la quantité ne se compte pas en répétitions.
  if (unite === "distance") return `${q.toLocaleString("fr-FR")} km`;
  return String(Math.round(q));
}

/**
 * Décompose un total de points par exercice en valeurs affichables. Chaque
 * exercice garde son unité : additionner des répétitions et des secondes pour
 * n'afficher qu'un seul nombre donnerait un résultat faux.
 */
export function ventiler(
  parExercice: Record<string, number>,
  ratios?: RatiosExercices | null,
): { id: ExerciceId; points: number; valeur: string }[] {
  return EXERCICE_IDS
    .filter((id) => (parExercice[id] ?? 0) > 0)
    .map((id) => ({
      id,
      points: parExercice[id],
      valeur: formaterCompact(parExercice[id], id, ratios),
    }));
}

/**
 * Format court pour les axes de graphique, où la place est comptée :
 * les durées sont arrondies à la minute au-delà d'une minute.
 */
export function formaterAxe(points: number, exercice: ExerciceId, ratios?: RatiosExercices | null): string {
  const q = quantite(points, exercice, ratios);
  const unite = EXERCICES[exercice].unite;
  if (unite === "distance") return `${q} km`;
  if (unite !== "temps") return String(q);
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
  // Pour une distance, `secondesParRep` porte les secondes par kilomètre :
  // c'est la même multiplication, avec une autre unité de départ.
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
