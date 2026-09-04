/**
 * Ce qu'un ami a le droit de voir, et qui en décide.
 *
 * Réponse 120 : « en détail, ou seulement son total ? — ce qu'il autorise ».
 * La décision appartient donc à celui qu'on regarde, jamais à celui qui
 * regarde, et elle s'applique À LA LECTURE. Filtrer à l'affichage laisserait
 * les chiffres sortir de la base et traverser le réseau : ils seraient dans
 * l'onglet réseau de qui les demande, c'est-à-dire exactement là où on a
 * choisi qu'ils ne soient pas.
 *
 * **Deux niveaux, pas trois.** La question posée oppose le détail au total ;
 * ajouter un « rien du tout » serait inventer une réponse qu'on n'a pas.
 * Quelqu'un qui ne veut rien montrer retire l'ami — c'est le geste qui existe.
 */

export const PARTAGES = ["total", "detail"] as const;
export type Partage = (typeof PARTAGES)[number];

/**
 * Le défaut est le plus FERMÉ.
 *
 * Quelqu'un qui n'ouvre jamais ses réglages ne doit pas se mettre à partager
 * davantage parce qu'on a ajouté une fonctionnalité. C'est la règle inverse
 * de celle du confort, et c'est la bonne pour tout ce qui sort du compte.
 */
export const PARTAGE_DEFAUT: Partage = "total";

export function toPartage(brut: unknown): Partage {
  return PARTAGES.includes(brut as Partage) ? (brut as Partage) : PARTAGE_DEFAUT;
}

/** Ce que le classement montre déjà à tous les amis. */
export type ProfilTotal = {
  pseudo: string;
  points: number;
  enRetard: boolean;
  joursDeRetard: number;
};

/**
 * Ce qui s'ajoute quand la personne l'autorise.
 *
 * **Le titre est ici et pas dans le total**, ce qui n'allait pas de soi : il
 * ne fait qu'un mot, il est flatteur par construction, et on pourrait le
 * croire anodin. Il ne l'est pas — « Increvable » DIT une série de trente
 * jours, c'est-à-dire précisément le chiffre que le mode « total » existe pour
 * taire. Un résumé d'un renseignement reste ce renseignement, et le publier
 * sous une autre forme est la façon la plus discrète de défaire un réglage.
 */
export type ProfilDetail = ProfilTotal & {
  parties: number;
  serie: number;
  meilleureSerie: number;
  jeuFavori: string | null;
  niveau: number;
  titre: string | null;
};

export type Profil =
  | ({ partage: "total" } & ProfilTotal)
  | ({ partage: "detail" } & ProfilDetail);

/**
 * Compose la réponse selon ce que la personne autorise.
 *
 * L'appelant charge tout, parce que lui seul parle à la base ; c'est ICI qu'on
 * décide de ce qui repart. Le détail n'est jamais recopié « au cas où » dans
 * la réponse totale : un champ qui ne doit pas partir ne part pas, même vide.
 */
export function composerProfil(
  partage: Partage,
  total: ProfilTotal,
  detail: Omit<ProfilDetail, keyof ProfilTotal>,
): Profil {
  if (partage === "detail") return { partage, ...total, ...detail };
  return { partage: "total", ...total };
}
