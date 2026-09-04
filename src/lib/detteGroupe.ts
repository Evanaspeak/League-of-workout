/**
 * La dette commune d'une équipe.
 *
 * Réponse 118 : « Cinq personnes, une dette commune, chacun paie ce qu'il
 * peut. Ça sauve celui qui décroche. » — et c'est la SECONDE moitié qui décide
 * de la forme. Ce qu'on veut n'est pas un compteur de plus : c'est qu'un
 * effort fait par quelqu'un puisse acquitter la dette d'un autre.
 *
 * **Il n'y a donc pas de second registre.** La dette commune est la SOMME des
 * dettes personnelles, c'est-à-dire une lecture, pas une écriture. En créer
 * une vraie obligerait à décider, à chaque paiement, laquelle des deux baisse
 * — et les deux réponses sont fausses : l'une compte l'effort deux fois,
 * l'autre le perd. Le seul invariant qui tienne depuis le premier jour est
 * qu'un point d'effort payé est une pompe que quelqu'un a faite ; un
 * transfert le respecte, un second compteur non.
 *
 * **Rien ici ne classe personne.** La réponse 117 refusait le duel — « celui
 * qui paie le plus gagne » — avec sa raison : « ça incite au mauvaise
 * performance ». Un tableau qui désignerait le meilleur payeur d'une équipe
 * dirait exactement la même chose sous un autre nom, puisqu'on paie ce qu'on
 * a perdu. L'écran montre donc ce qui est DÛ, jamais qui a le plus payé.
 */

/** Ce qu'une ligne de membre porte à l'écran. */
export type LigneEquipe = {
  id: string;
  pseudo: string;
  /** Points d'effort encore dus. Jamais négatif. */
  dus: number;
  /** Vrai pour la personne qui regarde. */
  moi: boolean;
};

export type DetteEquipe = {
  lignes: LigneEquipe[];
  /** Somme des dettes des membres VISIBLES. */
  total: number;
  /**
   * Nombre de membres écartés parce qu'ils sont en mode fantôme.
   *
   * Il est rendu pour que l'écran puisse dire ce que le total ne compte pas.
   * Un total qui tait ce qu'il omet est un total faux.
   */
  masques: number;
};

type MembreBrut = {
  id: string;
  pseudo: string | null;
  dettePointsDus: number;
  fantome: boolean;
};

/**
 * Ce que l'équipe doit, et qui n'y figure pas.
 *
 * **Le mode fantôme s'applique ici comme aux classements.** Quelqu'un qui a
 * demandé à ne pas voir sa ligne publiée à ses amis ne l'a pas demandé à
 * moitié : un tableau d'équipe montre le même couple pseudo + dette, et à
 * cinq une place suffit à désigner quelqu'un. Il est donc absent, et sa dette
 * ne compte pas dans le total.
 *
 * Ce qui serait pire que de l'exclure, c'est de l'exclure en silence : le
 * total ne serait plus celui de l'équipe, et personne ne saurait pourquoi.
 * D'où `masques`, que l'écran annonce.
 *
 * **On se voit toujours soi-même**, même en mode fantôme — se cacher des
 * autres n'est pas se cacher de soi. C'est la règle déjà posée pour le
 * classement, et elle vaut mot pour mot ici.
 */
export function composerDetteEquipe(membres: MembreBrut[], moiId: string): DetteEquipe {
  const visibles = membres.filter((m) => !m.fantome || m.id === moiId);
  const lignes: LigneEquipe[] = visibles.map((m) => ({
    id: m.id,
    pseudo: m.pseudo ?? "",
    dus: Math.max(0, m.dettePointsDus),
    moi: m.id === moiId,
  }));

  // L'ordre est celui de la dette, la plus lourde d'abord : c'est la personne
  // que la réponse 118 veut « sauver », et elle n'a aucune raison d'être en
  // bas de la liste. À égalité, le pseudo — sans quoi c'est la base qui
  // décide, et la liste saute d'un rechargement à l'autre.
  lignes.sort((a, b) => b.dus - a.dus || a.pseudo.localeCompare(b.pseudo) || a.id.localeCompare(b.id));

  return {
    lignes,
    total: lignes.reduce((somme, l) => somme + l.dus, 0),
    masques: membres.length - visibles.length,
  };
}

/**
 * Ce qu'un relais peut valoir, en points.
 *
 * Trois bornes, chacune pour une raison différente :
 *
 * - **jamais plus que ce que l'autre doit.** Au-delà, l'effort ne solde rien :
 *   il creuserait une dette négative, que tout le reste du produit borne déjà
 *   à zéro, donc il serait simplement perdu. Mieux vaut ne pas le proposer ;
 * - **jamais pour soi-même.** Le paiement ordinaire existe pour ça, et il
 *   passe par `/api/dette`, qui porte la file hors ligne et le jeton
 *   d'unicité. Un second chemin vers la même écriture est une divergence qui
 *   attend son heure ;
 * - **jamais zéro ou moins.** Un relais de zéro point écrirait une trace vide
 *   dans le registre, qui compterait dans la série de jours payés sans qu'un
 *   seul effort ait été fait.
 */
export type DecisionRelais =
  | { ok: true; points: number }
  | { ok: false; erreur: string; statut: number };

export function decisionRelais(
  demandes: unknown,
  beneficiaire: { id: string; dettePointsDus: number } | null,
  moiId: string,
): DecisionRelais {
  if (!beneficiaire) {
    // 404 et non 403 : distinguer « pas de votre équipe » de « n'existe pas »
    // apprendrait, identifiant par identifiant, quels comptes existent. C'est
    // la règle déjà posée pour le profil d'un ami et pour le groupe plein.
    return { ok: false, erreur: "Membre introuvable", statut: 404 };
  }
  if (beneficiaire.id === moiId) {
    return { ok: false, erreur: "Pour sa propre dette, le paiement ordinaire suffit", statut: 400 };
  }

  const points = typeof demandes === "number" ? demandes : NaN;
  if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) {
    return { ok: false, erreur: "Nombre de points invalide", statut: 400 };
  }

  const du = Math.max(0, beneficiaire.dettePointsDus);
  if (du === 0) {
    return { ok: false, erreur: "Ce membre ne doit plus rien", statut: 409 };
  }

  return { ok: true, points: Math.min(points, du) };
}
