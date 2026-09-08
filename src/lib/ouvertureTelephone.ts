/**
 * Sur téléphone, l'application s'ouvre sur l'ajout de partie.
 *
 * Réponse 210 : « Sur téléphone, quel écran devrait s'ouvrir en premier ?
 * Aujourd'hui c'est le tableau de bord » → **« L'ajout de partie »**. Sans clé
 * Riot de production, la saisie à la main est le SEUL moyen d'employer le
 * produit : c'est donc le geste qu'on vient faire, et il était à deux touches.
 *
 * **Le signal est le LANCEMENT de l'application, pas une heuristique.** Le
 * manifeste porte `start_url: /dashboard?ajout=1`, donc le paramètre n'est
 * présent que lorsque l'application a été ouverte depuis l'écran d'accueil.
 * Une navigation ordinaire vers le tableau de bord ne le porte jamais, et
 * personne ne se fait donc surprendre par un formulaire en revenant de
 * l'historique.
 *
 * Les trois autres conditions ont chacune leur raison, et aucune n'est
 * décorative :
 *
 * - **le pointeur grossier.** Le manifeste sert aussi aux installations de
 *   bureau, où la réponse ne dit rien — et où le rail est déplié de toute
 *   façon, donc le geste est déjà à une touche ;
 * - **aucune fenêtre déjà ouverte.** Deux modales empilées, c'est le défaut
 *   que ce projet a payé trois fois : la seconde recouvre la première et rien
 *   ne se clique derrière. On lit l'état RÉEL du document plutôt que de
 *   redériver les conditions de chacune, qui divergeraient ;
 * - **l'intro passée.** La visite guidée NAVIGUE d'une page à l'autre au fil
 *   de ses douze étapes, et elle démarre quelques secondes après le
 *   chargement — donc après le moment où l'on regarde. Le contrôle de fenêtre
 *   ne peut pas la voir ; celui-ci, si.
 *
 * **Ce que ça ne couvre PAS, écrit plutôt que laissé à découvrir** : quelqu'un
 * qui ouvre le site dans le navigateur de son téléphone, depuis un signet ou
 * un lien. On ne décide pas de ce qu'il a mis en signet, et ouvrir le
 * formulaire à CHAQUE visite du tableau de bord serait une surprise
 * désagréable au lieu d'un raccourci. Le jour où ça se décide autrement, c'est
 * la valeur de `demande` qui change, pas le reste.
 */

/** Le paramètre que le manifeste ajoute, et que le tableau de bord lit. */
export const PARAM_AJOUT = "ajout";

/** Ce que le manifeste met dans `start_url`. Écrit une fois, lu des deux côtés. */
export const DEPART_TELEPHONE = `/dashboard?${PARAM_AJOUT}=1`;

export type EtatOuverture = {
  /** L'application vient d'être lancée depuis l'écran d'accueil. */
  demande: boolean;
  /** Un pointeur grossier, donc un écran tactile. */
  telephone: boolean;
  /** Une fenêtre modale occupe déjà l'écran. */
  fenetreOuverte: boolean;
  /** L'accueil et la visite guidée sont passés pour ce compte. */
  introFaite: boolean;
};

export function ouvrirSurAjout(e: EtatOuverture): boolean {
  return e.demande && e.telephone && !e.fenetreOuverte && e.introFaite;
}
