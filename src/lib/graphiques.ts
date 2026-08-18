/**
 * Styles communs aux graphiques.
 *
 * Recharts ne lit pas les feuilles de style : ses couleurs se passent en
 * propriétés, ce qui les avait dispersées en dur dans sept graphiques du
 * tableau de bord. Les rassembler ici évite qu'un changement de teinte n'en
 * oublie la moitié — et rend une refonte visuelle possible depuis un seul
 * endroit.
 *
 * Les valeurs reprennent les jetons de `globals.css`, recopiées puisqu'on ne
 * peut pas y faire référence depuis une propriété JavaScript.
 */

const BONE = "#ECEFF4";
const CARBON = "#191D23";

/**
 * Graduations d'un axe : lisibles sans capter l'attention.
 *
 * Trois variantes s'étaient installées par dérive — opacité 0,4 ou 0,5, corps
 * 10 ou 11 — sans qu'aucune ne réponde à un besoin. Elles sont ramenées à deux
 * rôles : la densité de l'axe décide, pas l'endroit où on l'a écrit.
 */
export const AXE_TICK = { fill: "rgba(236,239,244,0.5)", fontSize: 11 } as const;

/** Même rôle, sur un axe chargé où le corps 11 se chevaucherait. */
export const AXE_TICK_DENSE = { fill: "rgba(236,239,244,0.5)", fontSize: 10 } as const;

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
  border: "1px solid rgba(236,239,244,0.15)",
  color: BONE,
} as const;

/** Coins d'une barre : arrondis en haut seulement, comme une colonne posée. */
export const RAYON_BARRE: [number, number, number, number] = [2, 2, 0, 0];

/** Quadrillage discret, sous les courbes uniquement. */
export const GRILLE_TRAIT = "rgba(152,162,176,0.1)";

/**
 * Teintes des séries. Une couleur par nature de donnée, jamais deux pour la
 * même : la dette est ambre partout, la comparaison entre jeux bleue, le détail
 * d'une période violet, la moyenne verte — seule courbe qui peut descendre.
 */
export const TEINTES = {
  dette: "#FFB454",
  jeux: "#6E9BFF",
  periode: "#9D7CFF",
  moyenne: "#2FD98A",
} as const;
