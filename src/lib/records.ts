/**
 * Le mur des records (ligne 140, réponse « Oui »).
 *
 * « Le plus grand nombre de pompes en une journée. » C'est la seule mesure du
 * produit qui récompense une POINTE plutôt qu'une régularité : le classement
 * dit qui a payé le plus cette semaine, la série dit qui n'a pas lâché, le
 * record dit qui a fait la plus grosse soirée. Les trois ne se remplacent pas.
 *
 * **Par période, oui ; par exercice, non — et c'est une limite, pas un
 * oubli.** La ligne demande « par exercice et par période ». `Paiement` ne
 * porte que des points et un jour : l'exercice vit sur le compte, où il change
 * quand on en change, et sur la partie, qui n'est pas ce qu'on paie. Un mur
 * « par exercice » demanderait de retenir l'exercice à chaque paiement, donc
 * une colonne et une décision sur ce qu'on fait des paiements déjà écrits. Ça
 * se dit plutôt que de se faire à moitié.
 *
 * **Entre amis, et rien d'autre pour l'instant.** La réponse 141 dit « au
 * choix » entre public et entre amis. Un mur PUBLIC est une surface
 * d'exposition nouvelle — il donne à qui n'a rien demandé une liste de pseudos
 * et d'efforts, c'est-à-dire exactement ce que la réponse 127 a refusé en
 * refusant l'annuaire. Le choix se construira, et son défaut sera le plus
 * fermé ; jusque-là le mur reste dans le cercle, comme le classement.
 */

/** Ce qu'un jour a rapporté à quelqu'un. */
export type JourPaye = { userId: string; jour: string; points: number };

export type Record = {
  id: string;
  pseudo: string;
  /** Le plus gros jour, en points d'effort. */
  points: number;
  jour: string;
  moi: boolean;
};

export type MurDesRecords = {
  mois: Record | null;
  toujours: Record | null;
};

/**
 * Le plus gros jour de chacun, puis le meilleur du cercle.
 *
 * **Un seul record par période, et pas un classement de plus.** Le tableau des
 * rangs existe déjà juste au-dessus ; répéter les mêmes pseudos dans un second
 * ordre n'apprend rien et double la place. Ce qu'un record dit tient en une
 * ligne : qui, combien, quel jour.
 *
 * **À égalité, c'est le plus ANCIEN qui tient.** Un record ne se prend pas en
 * égalant — c'est la règle de tous les records, et sans elle le titre
 * changerait de main à chaque soirée où quelqu'un refait le même chiffre.
 */
export function composerRecords(
  jours: JourPaye[],
  pseudos: Map<string, string>,
  moiId: string,
  prefixeDuMois: string | null,
): MurDesRecords {
  const meilleur = (parmi: JourPaye[]): Record | null => {
    let gagnant: JourPaye | null = null;
    for (const j of parmi) {
      if (!Number.isFinite(j.points) || j.points <= 0) continue;
      if (!pseudos.has(j.userId)) continue;
      if (
        gagnant === null
        || j.points > gagnant.points
        || (j.points === gagnant.points && j.jour < gagnant.jour)
      ) gagnant = j;
    }
    if (!gagnant) return null;
    return {
      id: gagnant.userId,
      pseudo: pseudos.get(gagnant.userId) as string,
      points: Math.floor(gagnant.points),
      jour: gagnant.jour,
      moi: gagnant.userId === moiId,
    };
  };

  return {
    mois: prefixeDuMois ? meilleur(jours.filter((j) => j.jour.startsWith(prefixeDuMois))) : null,
    toujours: meilleur(jours),
  };
}
