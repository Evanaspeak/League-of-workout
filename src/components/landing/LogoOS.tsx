/**
 * Le drapeau Windows, en quatre carreaux.
 *
 * Une forme géométrique élémentaire, dessinée ici plutôt qu'empruntée. Elle
 * n'est pas décorative : sur un bouton de téléchargement, elle répond avant le
 * texte à la seule question qui compte — « est-ce que ça tourne chez moi ? ».
 */
export function LogoWindows({ taille = 16 }: { taille?: number }) {
  const c = taille / 2 - taille * 0.045;   // demi-carreau, moins la gouttière
  const d = taille / 2 + taille * 0.045;
  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} fill="currentColor" aria-hidden focusable="false">
      <rect x="0" y="0" width={c} height={c} rx={taille * 0.06} />
      <rect x={d} y="0" width={c} height={c} rx={taille * 0.06} />
      <rect x="0" y={d} width={c} height={c} rx={taille * 0.06} />
      <rect x={d} y={d} width={c} height={c} rx={taille * 0.06} />
    </svg>
  );
}
