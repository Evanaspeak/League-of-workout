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
  /**
   * Le séparateur d'ÉNUMÉRATION, choisi par la langue.
   *
   * Il se joignait par `", "` dans les six, et la phrase qui l'entoure finit
   * par « 。 » en japonais : on lisait « 月 8, 火 8, 水 8。 », une virgule
   * latine au milieu d'idéogrammes.
   *
   * **`Intl.ListFormat` ne sait pas le faire**, et c'est mesuré plutôt que
   * supposé : avec `type: "unit"` il rend « A 8 B 12 » en japonais et
   * « A 8B 12 » en chinois, c'est-à-dire aucun séparateur — ces listes-là sont
   * faites pour « 5 ft 3 in », pas pour une énumération lue à voix haute. Le
   * séparateur vient donc du DICTIONNAIRE, comme le composé de `duree.ts`
   * quand `Intl` ne sait pas non plus : la langue qui ne peut pas déléguer
   * écrit sa forme elle-même.
   *
   * Il est OPTIONNEL : son absence garde le rendu d'avant, ce qui rend la
   * reprise des appelants sûre un par un.
   */
  separateur?: string,
): string | null {
  if (points.length === 0) return null;
  if (points.length > 8) {
    const valeurs = points.map((p) => Number(p[cleValeur] ?? 0));
    // Deux-points et non tiret cadratin : celui-ci est la ponctuation par
    // laquelle un texte écrit par une machine se reconnaît, et le projet le
    // refuse partout où quelqu'un lit. Le garde des dictionnaires ne pouvait
    // pas le voir ici — cette phrase se compose dans un composant.
    return `${points.length} : ${fmt(Math.min(...valeurs))} … ${fmt(Math.max(...valeurs))}`;
  }
  return points
    .map((p) => `${String(p[cleLabel])} ${fmt(Number(p[cleValeur] ?? 0))}`)
    .join(separateur ?? ", ");
}
