/**
 * Styles communs aux graphiques.
 *
 * Les couleurs de recharts se passent en propriétés, ce qui les avait
 * dispersées en dur dans sept graphiques du tableau de bord. Les rassembler
 * ici évite qu'un changement de teinte n'en oublie la moitié.
 *
 * **Elles lisent la palette, et le commentaire d'avant disait le contraire.**
 * Il annonçait « recopiées puisqu'on ne peut pas y faire référence depuis une
 * propriété JavaScript ». Mesuré, sur trois rectangles SVG — attribut de
 * présentation, style en ligne, littéral — les trois rendent la même couleur :
 * `fill="var(--amber)"` se résout parfaitement. Recharts pose ces valeurs sur
 * des attributs et sur le style de l'infobulle, donc les deux cas éprouvés.
 * La copie n'avait pas lieu d'être, et c'est elle qui laissait `--violet`
 * déclaré sans un seul lecteur.
 *
 * Ce qui reste littéral ici n'est pas dans la palette : la bordure de
 * l'infobulle à 15 % et le quadrillage à 10 % n'ont pas de nom. Les nommer est
 * une décision de palette, pas une correction.
 *
 * La sanction d'une erreur est franche : une `var()` qui ne se résout pas fait
 * retomber `fill` sur le noir. Le tableau de bord et les deux courbes des
 * réglages sont capturés par `scripts/comparer-rendu.mjs` aux trois largeurs.
 */

const BONE = "var(--bone)";
const CARBON = "var(--carbon-2)";

/**
 * Graduations d'un axe : lisibles sans capter l'attention.
 *
 * Trois variantes s'étaient installées par dérive — opacité 0,4 ou 0,5, corps
 * 10 ou 11 — sans qu'aucune ne réponde à un besoin. Elles sont ramenées à deux
 * rôles : la densité de l'axe décide, pas l'endroit où on l'a écrit.
 */
export const AXE_TICK = { fill: "var(--faint)", fontSize: 11 } as const;

/** Même rôle, sur un axe chargé où le corps 11 se chevaucherait. */
export const AXE_TICK_DENSE = { fill: "var(--faint)", fontSize: 10 } as const;

/** Axe dont les libellés portent du sens : un rôle, un champion. */
export const AXE_TICK_FORT = { fill: BONE, fontSize: 11 } as const;

/**
 * Même rôle sur un axe qui affiche toutes ses étiquettes sans en sauter
 * (`interval={0}`) : le corps 11 s'y chevaucherait dès quelques jeux.
 */
export const AXE_TICK_FORT_DENSE = { fill: BONE, fontSize: 10 } as const;

/** Cadre de l'infobulle : le panneau de l'application, en plus dense. */
export const INFOBULLE = {
  background: CARBON,
  border: "1px solid color-mix(in srgb, var(--bone) 15%, transparent)",
  color: BONE,
} as const;

/** Coins d'une barre : arrondis en haut seulement, comme une colonne posée. */
export const RAYON_BARRE: [number, number, number, number] = [2, 2, 0, 0];

/** Quadrillage discret, sous les courbes uniquement. */
export const GRILLE_TRAIT = "color-mix(in srgb, var(--steel) 10%, transparent)";

/**
 * Teintes des séries. Une couleur par nature de donnée, jamais deux pour la
 * même : la dette est ambre partout, la comparaison entre jeux bleue, le détail
 * d'une période violet, la moyenne verte — seule courbe qui peut descendre.
 */
export const TEINTES = {
  dette: "var(--amber)",
  jeux: "var(--signal)",
  periode: "var(--violet)",
  moyenne: "var(--victory)",
} as const;
