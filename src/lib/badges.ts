/**
 * Les paliers et les badges.
 *
 * Aujourd'hui, quelqu'un qui paie sa cinq-centième pompe ne voit rien se
 * passer. Ce n'est pas qu'un manque de fête : sans repère, l'effort accumulé
 * n'existe nulle part, et la seule chose que l'application sache dire est ce
 * qu'on doit encore.
 *
 * Tout se déduit de ce qui est déjà en base — points, parties, paiements. Rien
 * n'est stocké : un badge rangé dans une table finit par diverger de ce qu'il
 * prétend décrire le jour où une partie est supprimée.
 */

export type SourceBadges = {
  /** Points d'effort générés depuis toujours. */
  totalPoints: number;
  /** Parties enregistrées. */
  parties: number;
  /** Plus longue série de jours payés. */
  meilleureSerie: number;
  /** Nombre de jours distincts où quelque chose a été payé. */
  joursPayes: number;
};

export type Badge = {
  cle: string;
  /** Ce qu'il faut atteindre. */
  seuil: number;
  /** Où l'on en est, borné au seuil. */
  avancement: number;
  obtenu: boolean;
};

/**
 * Paliers de volume.
 *
 * Ils montent vite : cent est atteignable en une soirée, dix mille demande des
 * mois. Un palier qu'on atteint sans s'en rendre compte ne récompense rien, et
 * un palier hors d'atteinte ne motive personne — l'écart entre deux paliers
 * fait le travail.
 */
export const PALIERS_VOLUME = [100, 500, 1000, 5000, 10000, 25000];

/** Paliers de série, en jours consécutifs où la dette a été payée. */
export const PALIERS_SERIE = [3, 7, 30];

/** Paliers de parties enregistrées. */
export const PALIERS_PARTIES = [1, 25, 100, 500];

function palier(prefixe: string, seuil: number, valeur: number): Badge {
  return {
    cle: `${prefixe}${seuil}`,
    seuil,
    avancement: Math.min(seuil, Math.max(0, Math.round(valeur))),
    obtenu: valeur >= seuil,
  };
}

/** Tous les badges, obtenus ou non, dans l'ordre où on les atteint. */
export function tousLesBadges(source: SourceBadges): Badge[] {
  return [
    ...PALIERS_PARTIES.map((s) => palier("parties", s, source.parties)),
    ...PALIERS_VOLUME.map((s) => palier("volume", s, source.totalPoints)),
    ...PALIERS_SERIE.map((s) => palier("serie", s, source.meilleureSerie)),
  ];
}

/**
 * Le prochain palier à atteindre, toutes familles confondues.
 *
 * C'est le seul chiffre qui serve à quelque chose au quotidien : la liste
 * complète se consulte, le prochain palier se poursuit. On prend celui dont il
 * reste le moins à faire, en proportion — sinon on annoncerait toujours le
 * palier de parties, le plus facile en valeur absolue.
 */
export function prochainPalier(source: SourceBadges): Badge | null {
  const restants = tousLesBadges(source).filter((b) => !b.obtenu);
  if (restants.length === 0) return null;
  return restants.reduce((meilleur, b) =>
    b.avancement / b.seuil > meilleur.avancement / meilleur.seuil ? b : meilleur);
}

/**
 * Les paliers franchis entre deux états.
 *
 * Sert à annoncer le franchissement au moment où il a lieu, ce qui est le seul
 * moment où il compte. Comparer deux états plutôt que de relire une table :
 * un palier atteint puis reperdu — une partie supprimée — ne doit pas se
 * réannoncer au prochain passage.
 */
export function paliersFranchis(avant: SourceBadges, apres: SourceBadges): Badge[] {
  const avaient = new Set(tousLesBadges(avant).filter((b) => b.obtenu).map((b) => b.cle));
  return tousLesBadges(apres).filter((b) => b.obtenu && !avaient.has(b.cle));
}
