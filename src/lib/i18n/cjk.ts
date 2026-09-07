/**
 * L'espace qui ne doit pas rester entre deux idéogrammes.
 *
 * Le japonais et le chinois séparent volontiers un nombre ou un mot LATIN de
 * ce qui l'entoure — c'est la convention que ce projet suit partout :
 * « 60 試合 », « 12 局 ». Elle vaut parce que le morceau séparé est latin.
 *
 * Elle cesse de valoir quand la valeur interpolée est ELLE-MÊME en idéogrammes,
 * et c'est ce qui arrive depuis que les durées passent par `Intl` : le seuil de
 * la pastille rendait « 5分 から効きます » et « 5分钟 起生效 », une espace
 * latine plantée entre deux idéogrammes. Trouvé en LISANT l'écran en japonais,
 * juste après avoir corrigé l'unité — c'est la correction qui a rendu le défaut
 * visible.
 *
 * Et ça ne se décide pas à l'écriture du gabarit : la même clé reçoit « 5分20秒 »
 * pour la boxe et « 38 » pour les pompes. Retirer l'espace en dur casserait le
 * second cas, la garder casse le premier. C'est donc la VALEUR qui tranche, au
 * moment où elle est là.
 *
 * La voisine `rappelSeuilValeur` écrivait déjà « ${t}起 » et « ${t}から » sans
 * espace, trois lignes plus haut dans le même fichier : la règle était connue,
 * et appliquée à un de ses deux endroits.
 */

/**
 * Ce qui compte comme idéogramme : kana, sinogrammes, ponctuation CJK et
 * formes pleine chasse. Un chiffre latin et une lettre latine n'en sont pas —
 * c'est exactement ce qui distingue les deux cas.
 */
const CJK = "\\u3000-\\u303F\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF\\uFF00-\\uFFEF";
const SEAM = new RegExp(`([${CJK}]) +([${CJK}])`, "g");

/** « 5分20秒 から効きます » → « 5分20秒から効きます » ; « 38 が » reste tel quel. */
export function colleCjk(texte: string): string {
  // Deux passes : « 秒 か » consomme l'idéogramme de droite, donc une chaîne de
  // trois idéogrammes séparés par deux espaces n'en perdrait qu'une.
  return texte.replace(SEAM, "$1$2").replace(SEAM, "$1$2");
}
