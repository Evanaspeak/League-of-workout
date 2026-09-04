import { EXERCICES, estEnTemps, quantite, type ExerciceId, type RatiosExercices } from "@/lib/exercices";

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

/**
 * Ce qu'une quantité FAITE paie de la dette, entre 0 et 1.
 *
 * Le pendant du chrono, et il existe pour la raison que le propriétaire a
 * donnée : « si on convertit 10 min de boxe ça peut faire beaucoup de pompes à
 * faire en une fois ». On ne les fait donc pas toutes, et ce qu'on a fait doit
 * compter — exactement comme un décompte interrompu n'acquitte que les
 * secondes faites.
 *
 * **Le dénominateur est la quantité CONVERTIE, plancher compris.** C'est la
 * seule subtilité, et elle est la raison d'être de cette fonction : `quantite`
 * peut rendre zéro sur une petite dette, et `convertirDette` la relève à un
 * pas pour ne pas afficher « tu ne dois rien ». Diviser par la valeur brute
 * donnerait une division par zéro ; diviser par deux valeurs différentes de
 * part et d'autre de l'écran donnerait deux vérités — c'est le défaut déjà
 * payé où la pastille et le décompte annonçaient deux durées pour la même
 * dette, parce que l'un convertissait au navigateur et l'autre au serveur.
 *
 * Plafonnée à un : avoir fait plus que ce qu'on devait est un cas légitime, et
 * la dette ne devient pas négative pour autant.
 */
export function partPayeeQuantite(
  faite: number,
  points: number,
  exercice: ExerciceId,
  ratios?: RatiosExercices | null,
): number {
  const due = convertirDette(points, exercice, ratios).quantite;
  if (!(due > 0)) return 1;
  const f = Number.isFinite(faite) ? Math.max(0, faite) : 0;
  return Math.min(1, f / due);
}

/**
 * Ce qu'on PROPOSE réellement à l'écran, parmi ce qui est possible.
 *
 * Les exercices comptés en TEMPS sont écartés, et c'est une limite de portée
 * assumée plutôt qu'un oubli. Le besoin exprimé va dans l'autre sens — « je
 * dois dix minutes de boxe, je n'ai pas la place, je ferais bien des pompes » —
 * et convertir vers un second exercice au temps demanderait de recibler le
 * chrono sur une autre durée : c'est un autre écran, pas un bouton de plus.
 *
 * Proposer le bouton sans avoir construit ce qu'il ouvre serait pire que ne
 * pas le proposer : on clique, et on tombe sur un décompte qui parle de
 * l'exercice qu'on voulait justement éviter.
 */
export function conversionsProposees(dus: ExerciceId[]): ExerciceId[] {
  return conversionsPossibles(dus).filter((e) => !estEnTemps(e));
}

/**
 * Le nombre suivant sur le pas de l'exercice, sans traîner de flottant.
 *
 * Le compteur avance d'un pas par tape — une pompe, cent mètres. Additionner
 * naïvement laisse la trace que `quantite` évite déjà de son côté : trois fois
 * 0,1 vaut 0,30000000000000004, et le compteur afficherait ça en gros au
 * milieu de la fenêtre. On recale sur le nombre de décimales du pas, comme là
 * -bas, plutôt que d'écrire une deuxième arithmétique qui divergerait.
 *
 * Jamais négatif : on ne peut pas avoir fait moins que rien.
 */
export function surLePas(valeur: number, exercice: ExerciceId): number {
  const pas = EXERCICES[exercice].pas;
  const v = Number.isFinite(valeur) ? Math.max(0, valeur) : 0;
  if (Number.isInteger(pas)) return Math.round(v / pas) * pas;
  const decimales = String(pas).split(".")[1]?.length ?? 1;
  return Number((Math.round(v / pas) * pas).toFixed(decimales));
}
