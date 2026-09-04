/**
 * Ce qu'un défi personnel rapporte, et sous quelle forme on le retient.
 *
 * Réponse à la question 139 — « qu'est-ce qu'on gagne à finir un défi ? » —
 * restée « à voir » jusqu'à ce que le propriétaire tranche : de l'XP, et rien
 * d'autre, pour les défis PERSONNELS. Les défis partagés restent en suspens,
 * il les a explicitement remis à plus tard, et rien n'est inventé à leur place.
 *
 * ## Pourquoi ça se STOCKE, alors que rien d'autre ne se stocke
 *
 * Les paliers, le niveau et le titre se déduisent à tout instant de ce que la
 * base contient déjà, et c'est ce qui les empêche de diverger. Un défi fini ne
 * peut pas se déduire après coup : le tirage du jour est une fonction pure du
 * jour, mais savoir s'il a été REMPLI le 12 août demanderait les parties et les
 * paiements de ce jour-là, qu'on ne relit pas et qu'on ne relira jamais.
 *
 * On retient donc des LIGNES, comme `Paiement` — jamais un total. L'XP se
 * déduit par somme, donc elle ne peut pas se désynchroniser de ce qui la
 * produit, et une ligne se lit, se compte et s'explique. C'est le même
 * raisonnement qui a fait ranger `paiementEclairLe` en base : un moment ne se
 * recalcule pas.
 *
 * ## La limite, écrite plutôt que découverte
 *
 * La ligne s'écrit quand la route CONSTATE que le défi est rempli, donc au
 * prochain chargement d'un écran connecté. Un défi rempli un jour où l'on
 * n'ouvre jamais l'application n'est pas retenu. Le rattraper demanderait de
 * relire l'historique de chaque journée, ce qui coûte bien plus que ce que ça
 * rapporte — et le cas est rare : on remplit un défi en jouant, et on joue avec
 * l'application ouverte.
 */

/** Ce que rapporte un défi du jour rempli. Cinq activités, à peu près. */
export const XP_DEFI_JOUR = 50;

/** Ce que rapporte un défi du mois rempli. Trente activités, à peu près. */
export const XP_DEFI_MOIS = 300;

/** Une ligne à écrire : le défi, la période où il a été rempli, ce qu'il vaut. */
export type DefiAAcquitter = { cle: string; periode: string; xp: number };

/** Ce qu'un avancement de défi rend, quel que soit son horizon. */
type Avancement = { cle: string; fait: boolean };

/**
 * Les défis à retenir, à partir de ce que la route vient de calculer.
 *
 * **La période fait partie de l'identité de la ligne**, et c'est elle qui rend
 * l'écriture idempotente : un défi du jour se regagne un autre jour, un défi du
 * mois se regagne le mois suivant, mais aucun des deux ne se gagne deux fois
 * dans la même période. L'unicité est posée EN BASE et non ici — deux
 * chargements simultanés de la même page liraient tous deux « pas encore
 * retenu », et c'est le même raisonnement que pour la date de début de dette.
 *
 * Une période vide écarte le défi plutôt que d'écrire une ligne qu'aucune
 * requête ne retrouvera : c'est la famille du mois « 2026-13 », qui a la forme
 * d'une date sans en être une.
 */
export function defisAAcquitter(
  jour: string,
  mois: string,
  defiDuJour: Avancement | null,
  defisDuMois: Avancement[],
): DefiAAcquitter[] {
  const lignes: DefiAAcquitter[] = [];
  if (defiDuJour?.fait && jour) {
    lignes.push({ cle: defiDuJour.cle, periode: jour, xp: XP_DEFI_JOUR });
  }
  for (const d of defisDuMois) {
    if (d.fait && mois) lignes.push({ cle: d.cle, periode: mois, xp: XP_DEFI_MOIS });
  }
  return lignes;
}
