/**
 * Une file d'attente pour les écritures d'un même écran.
 *
 * Le défaut qu'elle ferme, mesuré au navigateur : chaque geste des réglages
 * pose l'état à l'écran puis envoie un `PUT`. Trois tapes sur un bouton « + »
 * envoyaient trois requêtes CONCURRENTES — relevé, quatre en vol à la fois —
 * et rien ne garantit leur ordre d'arrivée. La base pouvait donc garder la
 * valeur de l'avant-dernier geste pendant que l'écran montrait celle du
 * dernier. Ça ne se voyait qu'au rechargement suivant, où le réglage revenait
 * en arrière tout seul, sans que rien ne l'explique.
 *
 * C'est la troisième forme du même défaut sur cet écran, après le serveur qui
 * refuse et la lecture qui écrase une saisie : l'écran montre un réglage que
 * le serveur n'a pas.
 *
 * Elle vit ici plutôt que dans le composant pour la raison habituelle : une
 * décision écrite au milieu de neuf cents lignes n'est atteignable par aucun
 * test, et celle-ci se trompe dans un sens qui ne se voit jamais tout de
 * suite.
 */

/**
 * Ce que la file garantit, et rien de plus.
 *
 * - **Une seule tâche en vol.** C'est ce qui rend l'ordre d'arrivée égal à
 *   l'ordre d'envoi, donc le dernier geste gagnant.
 * - **L'ordre d'ENVOI est celui des appels.** Sans lui la file ne servirait à
 *   rien : elle déplacerait la course au lieu de la fermer.
 * - **Un échec n'emporte pas les suivants.** Chaque écriture a son propre
 *   retour en arrière, et un réglage refusé n'a pas à en annuler un autre que
 *   la personne a demandé après. La tâche qui lève rend son échec à SON
 *   appelant, jamais au voisin.
 *
 * Ce qu'elle ne fait PAS, écrit plutôt que supposé : elle ne fusionne rien.
 * Trois tapes envoient trois requêtes, la dernière portant la valeur finale.
 * Fusionner demanderait de savoir ce que deux écritures ont en commun, ce qui
 * est une décision de l'appelant.
 */
export function creerFile(): <T>(travail: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(travail: () => Promise<T>): Promise<T> => {
    // La queue retient une version NEUTRALISÉE, et c'est tout ce qu'il faut :
    // sans ce `catch`, une écriture refusée ferait rejeter toutes celles qui
    // la suivent, et l'appelant suivant verrait une erreur qui n'est pas la
    // sienne. Ce qui est rendu à l'appelant, lui, garde son échec.
    //
    // Un gestionnaire de rejet sur le `then` ci-dessous serait redondant, et
    // c'est le sabotage qui l'a dit : `queue` ne rejette jamais, donc le
    // retirer ne faisait tomber aucun test. Une ligne qui ne tient rien se
    // relit comme une garantie.
    const suivant = queue.then(() => travail());
    queue = suivant.catch(() => {});
    return suivant;
  };
}
