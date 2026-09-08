/**
 * Combien de parties l'historique montre par défaut.
 *
 * La réponse de `/api/games` grandit linéairement et pour toujours : une
 * partie jouée ne se supprime pas. Mesurée à 1 200 parties, elle pèse
 * 833 441 octets bruts — c'est-à-dire du processeur et de la mémoire chez qui
 * regarde, pas de la bande passante, puisque brotli la ramène à quelques
 * dizaines de kilo-octets sur le fil. À dix mille parties, elle en ferait sept
 * mégaoctets à sérialiser, à analyser et à allouer en objets.
 *
 * Cinquante est la décision du propriétaire du produit, prise le 8 septembre :
 * les cinquante dernières à l'écran, le reste archivé, et l'archive
 * accessible.
 *
 * Ce nombre ne vit PAS dans l'écran, et c'est délibéré : celui-ci affiche ce
 * qu'il a reçu et ce que le serveur annonce comme total. Un second exemplaire
 * de la borne finirait par diverger de celle qui tronque vraiment, et
 * l'écran annoncerait « les 50 dernières » sur une liste de trente.
 */
export const PARTIES_A_L_ECRAN = 50;
