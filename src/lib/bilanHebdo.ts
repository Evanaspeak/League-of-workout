/**
 * Le bilan de la semaine.
 *
 * L'application ne sait dire que le présent : ce qu'on doit, là, maintenant.
 * Elle ne dit jamais ce qu'on a fait. Sept jours de parties et de paiements
 * mis bout à bout racontent autre chose — et c'est la seule chose qu'on ait
 * envie de relire.
 *
 * Le calcul est pur : il prend des lignes et rend des nombres. C'est ce qui
 * permet de l'éprouver sans base, sans courriel et sans horloge.
 */

const JOUR_MS = 24 * 3600_000;

/** Fenêtre du bilan, en jours. */
export const JOURS_BILAN = 7;

/**
 * Délai minimum entre deux bilans. Six jours et non sept : un travail horaire
 * qui viserait exactement sept jours sauterait une semaine dès qu'une heure
 * de décalage s'y glisse — changement d'heure, exécution retardée par GitHub.
 */
export const JOURS_ENTRE_BILANS = 6;

export type PartieBilan = { createdAt: Date; result: string; pompesCalculees: number };
export type PaiementBilan = { createdAt: Date; points: number; jour: string };

export type Bilan = {
  parties: number;
  victoires: number;
  defaites: number;
  /** Points d'effort générés par les parties de la semaine. */
  pointsDus: number;
  /** Points effectivement acquittés dans la semaine. */
  pointsPayes: number;
  /** Jours distincts où quelque chose a été payé. */
  joursActifs: number;
};

function dansLaFenetre(quand: Date, maintenant: Date): boolean {
  const ecart = maintenant.getTime() - quand.getTime();
  return ecart >= 0 && ecart < JOURS_BILAN * JOUR_MS;
}

export function bilanHebdo(
  parties: PartieBilan[],
  paiements: PaiementBilan[],
  maintenant: Date = new Date(),
): Bilan {
  // La date d'ENREGISTREMENT, pas celle de la partie : une soirée rattrapée à
  // la main se date dans le passé et tomberait hors de la fenêtre alors qu'on
  // vient tout juste de la saisir.
  const recentes = parties.filter((p) => dansLaFenetre(p.createdAt, maintenant));
  const regles = paiements.filter((p) => dansLaFenetre(p.createdAt, maintenant));

  return {
    parties: recentes.length,
    victoires: recentes.filter((p) => p.result === "V").length,
    defaites: recentes.filter((p) => p.result === "D").length,
    pointsDus: recentes.reduce((s, p) => s + Math.max(0, p.pompesCalculees), 0),
    pointsPayes: regles.reduce((s, p) => s + Math.max(0, p.points), 0),
    joursActifs: new Set(regles.map((p) => p.jour)).size,
  };
}

/**
 * Y a-t-il de quoi écrire ?
 *
 * Une semaine sans une partie ne donne pas un bilan, elle donne un courriel
 * qui dit zéro — et un courriel qui dit zéro est celui qu'on se désabonne en
 * l'ouvrant. L'absence, elle, est déjà traitée par la relance.
 */
export function vautUnBilan(b: Bilan): boolean {
  return b.parties > 0;
}

/** Assez de temps s'est-il écoulé depuis le dernier bilan ? */
export function bilanDu(dernier: Date | null | undefined, maintenant: Date = new Date()): boolean {
  if (!dernier) return true;
  return maintenant.getTime() - dernier.getTime() >= JOURS_ENTRE_BILANS * JOUR_MS;
}
