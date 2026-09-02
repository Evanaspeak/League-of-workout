/**
 * Les règles de la visite guidée qui ne dépendent d'aucun état de React.
 *
 * Elles vivaient au milieu de quatre cent soixante lignes de composant, et
 * deux d'entre elles y étaient écrites DEUX FOIS : la liste des ancres d'une
 * étape, une fois pour la trouver et une fois pour la resuivre au défilement,
 * et la part d'écran qu'un cadre peut occuper, une fois dans la mesure et une
 * fois dans le contrôle de taille. C'est le motif déjà rencontré six fois sur
 * ce projet : ce n'est pas la copie qu'on remarque, c'est qu'une correction
 * n'en répare qu'une moitié.
 *
 * Ce que leur erreur coûte : la visite est la première chose qu'un compte neuf
 * rencontre. Une ancre mal choisie éclaire le vide ou saute l'étape ; un cadre
 * mal borné emmène la bulle hors de l'écran, et il n'y a plus rien à lire.
 */

/**
 * En dessous de cette largeur, le rail se replie derrière un bouton : ses
 * actions n'ont plus aucune surface à l'écran, et c'est le bouton qu'il faut
 * désigner.
 */
export const LARGEUR_ETROITE = 900;

/**
 * Part de la hauteur d'écran qu'un cadre peut occuper.
 *
 * Une ancre peut être immense — le tableau de l'historique dépasse quatre
 * mille pixels dès quelques dizaines de parties. L'entourer en entier
 * n'éclaire plus rien : le cadre déborde des deux côtés, et la bulle, placée
 * par rapport à lui, part avec.
 */
export const PART_ECRAN = 0.62;

export type AncresEtape = {
  cle: string;
  /** Ancre de remplacement sur écran étroit. */
  cleEtroite?: string;
  /**
   * Ancre de repli quand la principale n'existe pas encore : la pastille de
   * dette n'apparaît qu'une fois qu'on doit quelque chose, et les graphiques
   * qu'après quelques parties. Sans elle, ces étapes se sautaient — pour un
   * compte neuf, c'est-à-dire pour le seul public de cette visite.
   */
  cleSecours?: string;
};

/** Les ancres à essayer, dans l'ordre, pour une largeur d'écran donnée. */
export function clesCandidates(etape: AncresEtape, largeurEcran: number): string[] {
  const etroit = largeurEcran < LARGEUR_ETROITE;
  return [
    ...(etroit && etape.cleEtroite ? [etape.cleEtroite] : []),
    etape.cle,
    ...(etape.cleSecours ? [etape.cleSecours] : []),
  ];
}

export type Rectangle = { left: number; top: number; width: number; height: number };

/**
 * Le cadre à dessiner, ou `null` si l'élément n'occupe aucune surface.
 *
 * Un test « est-il dans l'écran ? » vivait ici, et c'est lui qui faisait
 * sauter des étapes : tout ce qui se trouvait sous la ligne de flottaison lui
 * était invisible, alors que c'est précisément ce qu'on allait amener à
 * l'écran juste après. Reste le seul critère qui compte : occuper des pixels.
 * Un rail replié ou une section non dépliée n'en occupe aucun, et l'éclairer
 * désignerait le vide.
 */
export function cadreDepuisRect(r: Rectangle, hauteurEcran: number): Rectangle | null {
  if (r.width === 0 || r.height === 0) return null;
  const hMax = Math.round(hauteurEcran * PART_ECRAN);
  return { left: r.left, top: r.top, width: r.width, height: Math.min(r.height, hMax) };
}

/** Vrai si l'élément est plus grand que ce que l'écran peut cadrer. */
export function tropGrandPourLEcran(hauteurRect: number, hauteurEcran: number): boolean {
  return hauteurRect > hauteurEcran * PART_ECRAN;
}
