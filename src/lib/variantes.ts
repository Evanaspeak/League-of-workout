import type { ExerciceId } from "./exercices";

/**
 * Variantes d'exécution qu'on peut déclarer pour soi.
 *
 * Elles ne changent aucun calcul : des pompes genoux au sol coûtent le même
 * nombre de points que des pompes complètes. Un ratio adapté aurait été plus
 * juste sur le papier et faux à l'usage — il aurait rendu la progression
 * invisible, alors que c'est précisément ce qu'on vient regarder. Voir ses
 * trois premières semaines annotées, puis l'annotation disparaître, dit
 * quelque chose qu'aucun coefficient ne dit.
 */
export const VARIANTES = ["genoux"] as const;
export type Variante = (typeof VARIANTES)[number];

/** L'exercice auquel chaque variante s'applique. */
export const EXERCICE_DE_LA_VARIANTE: Record<Variante, ExerciceId> = {
  genoux: "pompes",
};

/** Lit une variante venue du réseau. Tout le reste vaut « rien de déclaré ». */
export function toVariante(valeur: unknown): Variante | null {
  return typeof valeur === "string" && (VARIANTES as readonly string[]).includes(valeur)
    ? (valeur as Variante)
    : null;
}

/**
 * Une variante ne se retient que si l'exercice qu'elle qualifie fait bien
 * partie de l'effort concerné. Sans ce filtre, un réglage posé du temps des
 * pompes suivrait quelqu'un passé à la boxe, et l'historique annoncerait des
 * pompes genoux au sol qui n'ont jamais eu lieu.
 */
export function varianteApplicable(
  variante: Variante | null,
  exercices: readonly ExerciceId[],
): Variante | null {
  if (!variante) return null;
  return exercices.includes(EXERCICE_DE_LA_VARIANTE[variante]) ? variante : null;
}
