/**
 * Les réglages de la pastille, jeu par jeu.
 *
 * Ils vivaient dans `main.js`, et leur cas le plus délicat n'était éprouvé par
 * rien : la reprise de l'ANCIEN format. Les versions antérieures rangeaient
 * `overlay`, `overlayCoin` et `overlayPosition` à plat, pour un seul jeu.
 * Les ignorer aurait remis tout le monde au coin par défaut sans prévenir — et
 * le placement est la seule chose qui puisse rendre la pastille invisible.
 *
 * Rien ici ne dépend d'Electron : les réglages entrent et sortent par deux
 * fonctions qu'on passe en argument.
 */

/** Le jeu sous lequel se rangent les valeurs communes. */
const JEU_DEFAUT = "defaut";

/** Ce qu'on applique à un jeu dont on ne sait rien. */
function overlayNeutre(coins) {
  return { actif: true, coin: coins[0], position: null };
}

/**
 * La table complète, ancien format repris.
 *
 * L'entrée par défaut est reconstruite depuis les trois anciennes clés quand
 * elle manque : c'est ce qui fait qu'une mise à jour ne déplace pas la pastille
 * de quelqu'un qui l'avait rangée dans un coin.
 */
function overlayTable(reglages, coins) {
  const table = reglages.overlayJeux && typeof reglages.overlayJeux === "object"
    ? { ...reglages.overlayJeux }
    : {};
  if (!table[JEU_DEFAUT]) {
    table[JEU_DEFAUT] = {
      // `!== false` et non `=== true` : l'absence de réglage vaut « activée ».
      actif: reglages.overlay !== false,
      coin: coins.includes(reglages.overlayCoin) ? reglages.overlayCoin : coins[0],
      position: reglages.overlayPosition ?? null,
    };
  }
  return table;
}

/** Le réglage d'un jeu, complété par le défaut pour ce qu'il ne dit pas. */
function overlayDuJeu(reglages, coins, jeu) {
  const table = overlayTable(reglages, coins);
  const defaut = { ...overlayNeutre(coins), ...table[JEU_DEFAUT] };
  const propre = jeu && table[jeu] ? table[jeu] : {};
  return { ...defaut, ...propre };
}

/** La table après modification d'un jeu, sans rien écrire nulle part. */
function tableApresPatch(reglages, coins, jeu, patch) {
  const table = overlayTable(reglages, coins);
  const cle = jeu || JEU_DEFAUT;
  table[cle] = { ...overlayDuJeu(reglages, coins, cle), ...patch };
  return table;
}

module.exports = {
  JEU_DEFAUT, overlayNeutre, overlayTable, overlayDuJeu, tableApresPatch,
};
