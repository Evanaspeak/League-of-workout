/**
 * L'objectif collectif (ligne 133, réponse « Oui »).
 *
 * « Ensemble, 100 000 pompes ce mois-ci. » C'est la seule chose du produit qui
 * additionne l'effort de TOUT LE MONDE, et c'est ce qui la rend intéressante :
 * un compte neuf y voit qu'il n'est pas seul avant même d'avoir un ami.
 *
 * **La cible est celle de la réponse**, cent mille points, et il faut dire ce
 * qu'elle vaut aujourd'hui : à quatre comptes, la barre affichera quelques
 * pour cent. Une barre à trois pour cent est décourageante — sauf si elle dit
 * COMBIEN de gens l'ont remplie. « 8 420 sur 100 000, à 4 » est une phrase
 * vraie à toutes les tailles ; « 8 420 sur 100 000 » tout court ne l'est qu'à
 * partir d'une foule. Le nombre de contributeurs n'est donc pas une décoration
 * : c'est ce qui rend l'objectif honnête avant qu'il ne soit atteignable.
 *
 * **Rien de personnel n'en sort.** Une somme et un décompte, sur tous les
 * comptes : aucun pseudo, aucune ligne, rien qui désigne quelqu'un. C'est la
 * seule lecture du produit qui ne filtre pas par compte, et la raison est
 * écrite dans la dispense du garde.
 */

/** Ce qu'on vise ensemble sur un mois, en points d'effort. */
export const CIBLE_COLLECTIVE = 100000;

export type SourceCollectif = {
  /** Points payés par tout le monde sur le mois. */
  points: number;
  /** Combien de comptes y ont contribué. */
  contributeurs: number;
};

export type Collectif = {
  points: number;
  cible: number;
  contributeurs: number;
  /** Entre 0 et 1, pour dessiner la barre sans refaire le calcul à l'écran. */
  part: number;
  atteint: boolean;
};

export function composerCollectif(src: SourceCollectif): Collectif {
  const points = Number.isFinite(src.points) ? Math.max(0, Math.floor(src.points)) : 0;
  const contributeurs = Number.isFinite(src.contributeurs)
    ? Math.max(0, Math.floor(src.contributeurs))
    : 0;
  return {
    points,
    cible: CIBLE_COLLECTIVE,
    contributeurs,
    // Bornée à un : dépasser l'objectif est un cas légitime, une barre qui
    // déborde de son cadre non.
    part: Math.min(1, points / CIBLE_COLLECTIVE),
    atteint: points >= CIBLE_COLLECTIVE,
  };
}
