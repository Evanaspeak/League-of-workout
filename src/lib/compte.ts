/**
 * Ce qu'un compte peut montrer au navigateur.
 *
 * `getCurrentUser` n'extrait déjà plus l'empreinte du mot de passe de la base :
 * c'est là que vit la garantie, et un test la tient. Mais deux routes rendent
 * le compte par diffusion — `{ ...user }` — donc elles publient tout ce qu'on
 * leur remet, quelle qu'en soit la provenance. Cette fonction est le seul
 * endroit qui décide de ce qui part, pour que le jour où le compte arrivera
 * d'ailleurs, la réponse ne change pas de nature sans qu'on l'ait voulu.
 *
 * Elle vit à part d'`auth-helpers` parce que les tests de routes doublent ce
 * module entier : la fonction y serait remplacée par une doublure, et les
 * tests de fuite éprouveraient un filtre qui n'est pas celui qui tourne.
 *
 * C'est une liste de refus, pas une liste d'autorisations, et c'est un choix :
 * le compte porte une quarantaine de colonnes que les réglages affichent, les
 * énumérer une à une ferait diverger les deux listes à la première colonne
 * ajoutée. Le prix, c'est qu'une colonne nouvelle part par défaut — d'où
 * `src/lib/compte.test.ts`, qui lit le schéma et exige que chacune soit
 * classée. Une liste de refus sans recensement se referme sur ce qu'on
 * connaissait le jour où on l'a écrite.
 */
const NE_SORTENT_PAS = [
  // Le condensat du mot de passe. `getCurrentUser` ne le lit déjà plus ;
  // repris ici parce que le compte peut arriver d'ailleurs.
  "passwordHash",
  // Le jeton de la source OBS : une adresse publique qui montre la dette en
  // direct, SANS session. C'est un laissez-passer, pas un réglage. Il partait
  // à chaque chargement de page, puisque `/api/user` est lu par la navigation
  // — donc dans le cache du navigateur, dans l'onglet réseau des outils de
  // développement, et à l'écran de quiconque regarde une diffusion pendant
  // qu'ils sont ouverts. Sur un produit dont la fonction est justement de
  // s'afficher en direct, ce n'est pas une hypothèse d'école. Il se demande
  // par `/api/obs`, qui existe pour ça.
  "jetonObs",
  // Le compteur de révocation des sessions. Ce n'est pas un secret : c'est de
  // la mécanique interne, que le navigateur ne lit nulle part et n'a aucune
  // raison de connaître. Un compte public qui publie les rouages invite à
  // construire dessus, et ce qui est construit dessus devient à corriger le
  // jour où le rouage change.
  // La date du premier paiement éclair. Elle sort bien, mais transformée :
  // `/api/progression` en rend un BOOLÉEN, qui est tout ce que l'écran montre.
  // La date elle-même n'a aucun lecteur, et une donnée qui voyage à chaque
  // chargement de page sans que personne ne la lise est du gaspillage avant
  // d'être un risque. L'export de l'article 20 la porte, lui.
  "paiementEclairLe",
  "sessionEpoch",
  // Le code de parrainage. Il n'est pas secret — il est fait pour être
  // partagé — mais il n'a rien à voyager à chaque chargement de page : c'est
  // la leçon du jeton de diffusion, et elle vaut pour tout ce qu'un seul écran
  // consomme. Il se demande par `/api/parrainage`, qui le tire à la première
  // lecture.
  "codeParrain",
  // Qui m'a invité. C'est un renseignement sur QUELQU'UN D'AUTRE : le publier
  // dans la réponse que la navigation lit à chaque page dirait, à qui regarde
  // l'onglet réseau, par quel compte celui-ci est arrivé. Aucun écran ne le
  // demande.
  "parrainId",
  // Marque du dernier rappel de pesée envoyé, comme `rappelLe` et `bilanLe`.
  // Mécanique interne d'envoi : aucun écran ne la lit.
  "rappelPeseeLe",
] as const;

/**
 * Ce qui ne part pas en DIFFUSION, et qui part quand même aux réglages.
 *
 * La distinction manquait, et son absence a coûté la rubrique entière.
 *
 * Ces colonnes sont des données de SANTÉ au sens de l'article 9 — la variante
 * de formule, le niveau d'activité, le mode poursuivi, le poids visé, les
 * trois mesures du mètre-ruban, le rappel de pesée — plus le jeton du profil
 * public, qui est un laissez-passer. Aucune n'a de raison de traverser
 * `/api/user` ni `/api/contexte`, que la navigation lit à CHAQUE page : la
 * source OBS s'affiche par-dessus un stream, devant le public de quelqu'un
 * d'autre.
 *
 * Mais `/api/settings` sert la personne son PROPRE compte, derrière la porte,
 * et c'est le seul écran qui les affiche et les change. Les retirer là aussi
 * les rendait **écrites et jamais relues** : on choisissait « Perdre », on
 * rechargeait, et tout était revenu à « Rien pour l'instant ». Le
 * commentaire d'à côté écrivait pourtant la règle depuis le premier jour —
 * « elles se demandent par `/api/settings` » — et personne ne l'avait
 * appliquée. Une garantie décrite qui n'existe pas se relit comme une
 * garantie.
 */
const HORS_DIFFUSION = [
  "jetonProfil",
  "formuleCalorique",
  "niveauActivite",
  "modeCalorique",
  "poidsCible",
  "tourTaille",
  "tourCou",
  "tourHanches",
  "rappelPeseeActif",
] as const;

type Secret = (typeof NE_SORTENT_PAS)[number];
type HorsDiffusion = (typeof HORS_DIFFUSION)[number];

function sans<T extends object, C extends readonly string[]>(
  user: T, cles: C,
): T {
  const copie = { ...(user as T & Record<string, unknown>) };
  for (const cle of cles) delete copie[cle];
  return copie as T;
}

/**
 * Le compte tel qu'il peut partir en DIFFUSION : `/api/user`, `/api/contexte`.
 *
 * C'est le filtre le plus serré des deux, et c'est le défaut : une colonne
 * nouvelle qui n'a pas été rangée part par ici, donc `compte.test.ts` exige
 * qu'on la range.
 */
export function comptePublic<T extends object>(user: T): Omit<T, Secret | HorsDiffusion> {
  return sans(sans(user, NE_SORTENT_PAS), HORS_DIFFUSION) as Omit<T, Secret | HorsDiffusion>;
}

/**
 * Le compte tel qu'il part aux RÉGLAGES : son propriétaire, derrière la porte.
 *
 * Les secrets tombent toujours — l'empreinte du mot de passe, le jeton de
 * diffusion, le code de parrainage. Ce qui reste est ce que la personne a
 * elle-même réglé, et qu'elle doit pouvoir relire pour le changer.
 */
export function compteReglages<T extends object>(user: T): Omit<T, Secret> {
  return sans(user, NE_SORTENT_PAS) as Omit<T, Secret>;
}
