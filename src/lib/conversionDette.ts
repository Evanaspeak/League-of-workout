import { EXERCICES, quantite, type ExerciceId, type RatiosExercices } from "@/lib/exercices";

/**
 * Voir sa dette dans un autre exercice, et la payer ainsi.
 *
 * Demandé par le propriétaire : « il faudrait un bouton "convertir en" quand
 * l'on clique sur le rappel de la boxe ». Le besoin est net — on doit six
 * minutes de boxe, on n'a pas la place de boxer, on ferait bien des pompes à
 * la place — et il ne demande aucune donnée nouvelle : un point d'effort vaut
 * une pompe depuis le premier jour, et c'est déjà dans cette unité que tout
 * est enregistré.
 *
 * ## Ce que convertir CHANGE, et ce que ça ne change pas
 *
 * **Rien de ce qu'on doit.** La dette est en POINTS. L'exercice n'est qu'une
 * façon de les exprimer et de les rendre : convertir change l'unité, jamais le
 * montant. C'est ce qui rend l'opération sûre — il n'y a aucun chemin par
 * lequel elle puisse effacer quoi que ce soit.
 *
 * **Ni le réglage du compte.** Une fenêtre qui réécrirait en silence une
 * préférence durable est le défaut que ce projet corrige en boucle. « Convertir
 * en » vaut pour CE paiement ; l'exercice habituel se change dans les réglages,
 * où l'on sait ce qu'on fait.
 *
 * ## La règle qui a fait écrire ce module
 *
 * `quantite` arrondit au pas de l'exercice, avec `Math.round` : une petite
 * dette convertie en course — dont le pas est de cent mètres — peut rendre
 * **zéro**. Affiché tel quel, ça dit « tu ne dois rien » à quelqu'un qui doit
 * encore quelque chose, et le bouton deviendrait une gomme.
 *
 * Une dette non nulle rend donc toujours au moins UN pas. C'est la seule règle
 * de ce module, et c'est pour elle qu'il existe plutôt que d'appeler
 * `quantite` depuis le composant.
 */

export type Conversion = {
  exercice: ExerciceId;
  /** La quantité à faire, dans l'unité de l'exercice. Jamais nulle si on doit. */
  quantite: number;
  /** Les points d'origine, inchangés : c'est eux qu'on paie. */
  points: number;
};

export function convertirDette(
  points: number,
  exercice: ExerciceId,
  ratios?: RatiosExercices | null,
): Conversion {
  const pts = Number.isFinite(points) ? Math.max(0, points) : 0;
  const brut = quantite(pts, exercice, ratios);
  /**
   * Le plancher ne s'applique qu'à une dette RÉELLE. Zéro point doit rendre
   * zéro : afficher « 100 m à courir » à quelqu'un qui ne doit rien serait la
   * faute inverse, et elle est aussi grave.
   */
  const q = pts > 0 && brut <= 0 ? EXERCICES[exercice].pas : brut;
  return { exercice, quantite: q, points: pts };
}

/**
 * Les exercices qu'on peut proposer, celui qu'on doit déjà écarté.
 *
 * Proposer « convertir en boxe » sous une dette déjà exprimée en boxe est un
 * bouton qui ne fait rien : on le clique une fois, on comprend qu'il ne sert à
 * rien, et on cesse de regarder les autres. Une dette répartie sur PLUSIEURS
 * exercices, elle, se convertit vers n'importe lequel — y compris l'un des
 * siens, puisque le regrouper en un seul est justement le geste.
 */
export function conversionsPossibles(dus: ExerciceId[]): ExerciceId[] {
  const tous = Object.keys(EXERCICES) as ExerciceId[];
  if (dus.length === 1) return tous.filter((e) => e !== dus[0]);
  return tous;
}
