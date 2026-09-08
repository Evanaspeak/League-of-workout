/**
 * Les jeux qui racontent leur partie en cours.
 *
 * L'API locale de Riot (port 2999) publie le score, l'horloge et la fin de
 * partie ; League of Legends et Teamfight Tactics tournent dans le même
 * client, donc les deux en profitent. Pour eux, la lecture d'écran n'a aucun
 * intérêt — l'API dit tout, et plus vite — et la pastille peut annoncer ce
 * qu'une victoire ou une défaite coûtera.
 *
 * Ce que la distinction change à l'AFFICHAGE, et qui vient de `overlay.js` :
 * une ligne qui ne peut JAMAIS se remplir doit disparaître, pas afficher un
 * tiret. Un tiret se lit comme « en attente », et on attend alors quelque
 * chose qui ne viendra pas.
 *
 * La liste était écrite TROIS fois : ici sous deux noms différents pour le
 * même ensemble (`JEUX_QUI_SE_RACONTENT` dans `main.js`, `JEUX_AVEC_RELEVE`
 * dans `overlay.js`), et une troisième fois côté site. Les trois coïncidaient,
 * ce qui est le cas normal jusqu'au jour où l'une bouge.
 *
 * **Elle reste une copie**, et c'est voulu : la coquille se construit sans le
 * paquet du site, donc elle ne peut pas importer le catalogue. C'est ce qui ne
 * peut pas s'importer qui se COMPARE — `src/jeuxQuiSeRacontent.test.ts` le
 * fait, comme `jeuxDetectables.test.ts` le fait déjà pour la table des
 * processus surveillés.
 */
const JEUX_QUI_SE_RACONTENT = new Set(["League of Legends", "Teamfight Tactics"]);

module.exports = { JEUX_QUI_SE_RACONTENT };
