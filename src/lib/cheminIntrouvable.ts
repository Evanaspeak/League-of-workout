/**
 * L'adresse de la 404 du site, seule dans son module.
 *
 * Elle vivait dans `pagesConnues.ts`, et `routesPubliques.ts` l'y importait
 * pour une constante de douze caractères. Or `routesPubliques` est lu par
 * `Nav`, qui est CLIENT et rendu sur chaque page : l'import traînait tout
 * `pagesConnues` dans le paquet du navigateur, donc le développement des
 * adresses du calculateur et le catalogue des jeux derrière.
 *
 * **Ce que le retrait fait, et ce qu'il ne fait pas.** Le module disparaît
 * pour de bon — vérifié à l'empreinte : la chaîne `/calculateur/${slug}`
 * n'est plus dans aucun fragment chargé par le tableau de bord. Le TOTAL, lui,
 * ne bouge pas d'un kilo-octet : ce module est petit, et les
 * soixante-treize kilo-octets apparus en V460 viennent d'ailleurs. Les deux
 * choses ont été mesurées séparément, et il valait mieux le dire que de
 * laisser croire que celle-ci répare celle-là.
 */
export const CHEMIN_INTROUVABLE = "/introuvable";
