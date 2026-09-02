/**
 * Les règles du chrono d'une session au temps.
 *
 * Elles vivaient dans `SessionContext`, qui fait cinq cents lignes et n'avait
 * aucun test : c'est un composant, et ce qui s'y éprouve n'est pas le rendu
 * mais les décisions. Sorties ici, elles se jouent en quelques millisecondes.
 *
 * Ce qu'elles décident coûte cher quand elles se trompent : une reprise ratée
 * fait disparaître deux heures de jeu sur un rechargement de page, et une
 * reprise abusive fait payer une soirée d'avant-hier.
 */

/** Ce que le navigateur garde d'un chrono en cours. */
export type ChronoSauvegarde = { jeu: string; debut: number; niveau: number };

/**
 * Au-delà de douze heures, c'est un chrono oublié, pas une session en cours.
 *
 * La borne est haute exprès : une soirée qui déborde sur la nuit reste une
 * soirée, et perdre son décompte parce qu'on a laissé l'onglet ouvert serait
 * pire que de compter un peu large. Ce qu'elle écarte, c'est le chrono d'il y
 * a trois jours.
 */
export const CHRONO_OUBLI_MS = 12 * 3600 * 1000;

/**
 * Le chrono à reprendre, ou `null` s'il n'y a rien à reprendre.
 *
 * `null` veut dire « efface ce qui est stocké » dans tous les cas : une valeur
 * illisible, une valeur sans date, une valeur trop vieille se traitent pareil
 * du point de vue de l'appelant — il n'y a pas de session à reprendre.
 */
export function chronoARestaurer(brut: string | null, maintenant: number): ChronoSauvegarde | null {
  if (!brut) return null;

  let lu: unknown;
  try {
    lu = JSON.parse(brut);
  } catch {
    return null;
  }
  if (!lu || typeof lu !== "object") return null;

  const { jeu, debut, niveau } = lu as Record<string, unknown>;
  const commence = Number(debut);
  // `Number(undefined)` vaut NaN et `Number(null)` vaut 0 : les deux sont
  // refusés par la même condition, et c'est voulu — un chrono qui aurait
  // commencé au premier janvier 1970 n'est pas un chrono.
  if (!commence || !Number.isFinite(commence)) return null;
  // Un chrono qui commence dans le futur vient d'une horloge changée entre
  // deux ouvertures : le reprendre donnerait une durée négative.
  if (commence > maintenant) return null;
  if (maintenant - commence > CHRONO_OUBLI_MS) return null;
  if (typeof jeu !== "string" || jeu === "") return null;

  return { jeu, debut: commence, niveau: Number(niveau) || 0 };
}

/**
 * Ce que le temps écoulé a coûté, en points.
 *
 * Arrondi à l'entier : la dette se compte en points, et une valeur à virgule
 * ferait apparaître « 12,4 pompes » à l'écran.
 */
export function pointsDuChrono(
  debutMs: number | null,
  pointsParHeure: number,
  maintenant: number,
): number {
  if (debutMs === null) return 0;
  const ecouleSec = (maintenant - debutMs) / 1000;
  // Une horloge qui recule ne crée pas de crédit : on ne descend pas sous zéro.
  if (ecouleSec <= 0) return 0;
  return Math.round((pointsParHeure * ecouleSec) / 3600);
}

/** Ce qui reste à devoir une fois retiré ce qui a déjà été porté au compteur. */
export function resteAPayer(total: number, dejaPaye: number): number {
  return Math.max(0, total - dejaPaye);
}
