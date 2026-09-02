/**
 * La série de jours où la dette a été payée.
 *
 * Elle compte les jours où l'on a PAYÉ, jamais ceux où l'on a joué. C'est la
 * différence entre une application qui récompense l'effort et une qui
 * récompense le temps passé sur un jeu — et le produit n'a de sens que si
 * c'est la première.
 *
 * Aucun pardon : une série cassée repart de zéro. Un gel se gagne, il ne se
 * donne pas.
 */

/** Un jour local, au format AAAA-MM-JJ. */
export type Jour = string;

/** Le jour local d'une date, dans le fuseau de la machine qui appelle. */
export function jourLocal(d: Date = new Date()): Jour {
  const deux = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/**
 * Une étiquette de calendrier qui désigne un vrai jour.
 *
 * La FORME ne suffit pas, et cette leçon a déjà été payée une fois : « 9999-99-99 »
 * respecte le motif sans être une date, et « 2026-02-30 » n'est pas rejeté par
 * `Date` selon la plateforme — il glisse au 2 mars, et la journée montrée n'est
 * alors pas celle demandée. Le contrôle porte donc sur l'ALLER-RETOUR : on
 * réécrit la date et on la compare à celle qu'on nous a donnée.
 *
 * La règle vivait dans `/api/dashboard/daily` seule, et `/api/progression`
 * s'en tenait au motif : « 9999-99-99 » y passait, donnait une série de zéro,
 * et court-circuitait le repli prévu pour ce cas exact. Deux exemplaires d'une
 * règle divergent toujours ; celui-là avait déjà commencé.
 *
 * `toISOString` lève sur une date invalide : on regarde d'abord qu'elle en est
 * une, sinon le contrôle devient lui-même la panne.
 */
export function estJourValide(jour: string | null | undefined): jour is Jour {
  if (!jour || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) return false;
  const d = new Date(`${jour}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === jour;
}

/** Le jour qui précède celui donné. */
export function jourPrecedent(jour: Jour): Jour {
  // `Date.UTC` évite qu'un changement d'heure retire ou ajoute un jour : on ne
  // manipule ici que des étiquettes de calendrier, jamais des instants.
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Différence en jours entre deux étiquettes de calendrier. */
export function ecartEnJours(depuis: Jour, jusqua: Jour): number {
  const enMs = (jour: Jour) => {
    const [a, m, j] = jour.split("-").map(Number);
    return Date.UTC(a, m - 1, j);
  };
  return Math.round((enMs(jusqua) - enMs(depuis)) / 86_400_000);
}

/**
 * Longueur de la série qui se termine aujourd'hui, ou hier.
 *
 * Hier compte encore : une série ne doit pas paraître cassée à neuf heures du
 * matin parce qu'on n'a pas encore payé la dette du jour. Elle ne casse qu'au
 * saut d'un jour entier.
 */
export function longueurSerie(jours: Jour[], aujourdhui: Jour = jourLocal()): number {
  const vus = new Set(jours);
  if (vus.size === 0) return 0;

  let curseur = aujourdhui;
  if (!vus.has(curseur)) {
    curseur = jourPrecedent(curseur);
    if (!vus.has(curseur)) return 0;
  }

  let longueur = 0;
  while (vus.has(curseur)) {
    longueur += 1;
    curseur = jourPrecedent(curseur);
  }
  return longueur;
}

/** La plus longue série jamais tenue, série courante comprise. */
export function meilleureSerie(jours: Jour[]): number {
  const tri = [...new Set(jours)].sort();
  let meilleure = 0;
  let courante = 0;
  let precedent: Jour | null = null;
  for (const jour of tri) {
    courante = precedent !== null && ecartEnJours(precedent, jour) === 1 ? courante + 1 : 1;
    if (courante > meilleure) meilleure = courante;
    precedent = jour;
  }
  return meilleure;
}

/** À partir de combien de jours une dette non payée se dit « en retard ». */
export const JOURS_AVANT_RETARD = 3;

export type EtatRetard = { enRetard: boolean; jours: number };

/**
 * Depuis combien de jours la dette court, et faut-il le dire.
 *
 * Une dette de quelques heures n'est pas un retard : c'est le fonctionnement
 * normal. Trois jours, en revanche, veut dire qu'on a cessé de payer, et c'est
 * le seul moment où le signaler sert à quelque chose.
 */
export function etatRetard(
  detteDepuis: Date | null | undefined,
  pointsDus: number,
  maintenant: Date = new Date(),
): EtatRetard {
  if (!detteDepuis || pointsDus <= 0) return { enRetard: false, jours: 0 };
  const jours = Math.floor((maintenant.getTime() - detteDepuis.getTime()) / 86_400_000);
  // Un `detteDepuis` dans le futur ne peut venir que d'une horloge décalée :
  // on n'en fait pas un retard négatif.
  const surs = Math.max(0, jours);
  return { enRetard: surs >= JOURS_AVANT_RETARD, jours: surs };
}
