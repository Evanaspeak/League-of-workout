"use client";

/**
 * Le résumé d'un graphique, pour qui ne le voit pas.
 *
 * Un graphique porte son sens dans sa forme, et la forme n'existe que pour la
 * vue. Un lecteur d'écran annonce « graphique » et s'arrête là. Le texte
 * ci-dessous porte donc les chiffres eux-mêmes : combien de points, d'où à où,
 * ou la valeur de chaque barre quand elles sont peu nombreuses.
 *
 * Il est invisible à l'œil, et n'occupe pas de place dans la mise en page.
 */
export function ResumeGraphique({ texte }: { texte: string }) {
  return <p className="lecture-ecran">{texte}</p>;
}

/**
 * Décrit une série qui évolue : son étendue suffit, énumérer cinquante points
 * ne serait pas lisible à l'oreille.
 */
export function decrireEvolution<P extends Record<string, unknown>>(
  points: P[],
  cle: keyof P,
  fmt: (v: number) => string,
): { n: number; debut: string; fin: string } | null {
  if (points.length === 0) return null;
  const valeur = (p: P) => Number(p[cle] ?? 0);
  return {
    n: points.length,
    debut: fmt(valeur(points[0])),
    fin: fmt(valeur(points[points.length - 1])),
  };
}

/**
 * Décrit une répartition : chaque barre est nommée avec sa valeur, parce
 * qu'elles sont peu nombreuses et que c'est la comparaison qui compte.
 *
 * Au-delà de huit barres on retombe sur l'étendue : une énumération plus
 * longue ne se retient pas à l'écoute.
 */
export function decrireRepartition<P extends Record<string, unknown>>(
  points: P[],
  cleLabel: keyof P,
  cleValeur: keyof P,
  fmt: (v: number) => string,
): string | null {
  if (points.length === 0) return null;
  if (points.length > 8) {
    const valeurs = points.map((p) => Number(p[cleValeur] ?? 0));
    return `${points.length} — ${fmt(Math.min(...valeurs))} … ${fmt(Math.max(...valeurs))}`;
  }
  return points
    .map((p) => `${String(p[cleLabel])} ${fmt(Number(p[cleValeur] ?? 0))}`)
    .join(", ");
}
