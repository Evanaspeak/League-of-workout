import {
  dureeEffort, exercicesEnTemps, repartirPoints, toExerciceIds,
} from "@/lib/exercices";

/**
 * Ce qu'un écran connecté a besoin de savoir sur le compte, dès l'ouverture.
 *
 * Trois routes rendaient ces trois blocs séparément, et chacune commençait par
 * la même chose : lire la session, puis lire le compte. Sur une page connectée,
 * elles partaient toutes les trois — soit trois allers-retours et trois
 * lectures du même enregistrement, à chaque chargement. En production, chaque
 * requête SQL est un appel HTTPS indépendant vers Neon.
 *
 * Les constructeurs de réponse vivent ici plutôt que dans les routes, pour que
 * `/api/contexte` et les trois routes d'origine rendent EXACTEMENT la même
 * chose. Recopier la mise en forme aurait produit deux vérités qui divergent à
 * la première correction — c'est le défaut le plus souvent rencontré sur ce
 * projet, six fois à ce jour.
 */

/**
 * Dette en attente. Seuls les exercices comptés en temps s'y accumulent : des
 * pompes se font tout de suite après la partie, tandis qu'un round de boxe n'a
 * d'intérêt qu'une fois quelques minutes réunies.
 */
export function reponseDette(user: {
  dettePointsDus: number;
  rappelSeuilSec: number;
  exercices: string[];
}) {
  const exercices = exercicesEnTemps(toExerciceIds(user.exercices));
  // Sans exercice au temps sélectionné, il n'y a rien à cumuler.
  const points = exercices.length > 0 ? Math.max(0, user.dettePointsDus) : 0;
  return {
    points,
    exercices,
    /** Ce qu'il y a à faire, exercice par exercice. */
    repartition: repartirPoints(points, exercices),
    /** Temps de travail que ça représente, en secondes. */
    dureeSec: Math.round(dureeEffort(points, exercices)),
    /** Seuil de déclenchement du rappel, en secondes d'effort. 0 = désactivé. */
    seuilSec: Math.max(0, user.rappelSeuilSec),
  };
}

export type EtatConsentement = "jamais" | "accepte" | "refuse";

export function etatConsentement(
  user: { santeConsentiLe: Date | null; santeRefuseLe: Date | null },
): EtatConsentement {
  if (user.santeConsentiLe) return "accepte";
  if (user.santeRefuseLe) return "refuse";
  return "jamais";
}

/**
 * L'état du consentement santé, et de quoi formuler la question.
 *
 * « A-t-il déjà des données ? » change le texte : on ne demande pas la même
 * chose à quelqu'un dont on détient déjà le poids qu'à quelqu'un qui n'a rien
 * donné.
 */
export function reponseConsentement(user: {
  santeConsentiLe: Date | null;
  santeRefuseLe: Date | null;
  genre: string | null;
  age: number | null;
  poids: number | null;
  taille: number | null;
  sportsHoursPerWeek: number | null;
}) {
  return {
    etat: etatConsentement(user),
    aDesDonnees: Boolean(
      user.genre || user.age || user.poids || user.taille || user.sportsHoursPerWeek,
    ),
    depuis: user.santeConsentiLe ?? user.santeRefuseLe ?? null,
  };
}
