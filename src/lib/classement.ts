import { nomPublie } from "@/lib/nomAffiche";
/**
 * Le classement entre amis, sur le volume PAYÉ.
 *
 * Pas sur le classement en jeu, et pas non plus sur les parties enregistrées :
 * sur ce qui a été fait. C'est la réponse 115, et elle a sa raison — quelqu'un
 * qui perd beaucoup accumule beaucoup de dette, donc classer sur les parties
 * reviendrait à récompenser la défaite. Le seul chiffre qui dise « j'ai fait
 * l'effort » est celui des séances payées.
 *
 * Ce module ne parle à personne : il reçoit des comptes et des totaux, il rend
 * des lignes ordonnées. Les décisions qu'il porte se paient toutes à
 * l'affichage, et aucune ne s'éprouve depuis une route.
 */
import { ecartEnJours, etatRetard, jourPrecedent, type Jour } from "@/lib/serie";

/**
 * Sept jours glissants, et pas le total de toujours.
 *
 * Un classement cumulatif est décidé par la DATE D'INSCRIPTION : celui qui est
 * arrivé le premier a un total que personne ne rattrape, et le dernier venu
 * regarde un tableau où sa place ne dépend plus de ce qu'il fait. C'est
 * l'inverse d'une raison de revenir.
 *
 * Sept jours se regagnent chaque semaine, et c'est la durée d'un rythme de jeu
 * : on ne joue pas tous les jours, on joue certains soirs. Trois jours
 * puniraient une semaine chargée ; trente redeviendraient un cumul.
 */
export const JOURS_CLASSEMENT = 7;

/** Le premier jour compté, aujourd'hui inclus dans la fenêtre. */
export function debutFenetre(aujourdhui: Jour, jours: number = JOURS_CLASSEMENT): Jour {
  let curseur = aujourdhui;
  for (let i = 1; i < jours; i += 1) curseur = jourPrecedent(curseur);
  return curseur;
}

export type CompteClasse = {
  id: string;
  pseudo: string | null;
  riotId?: string | null;
  nomAffiche?: string | null;
  detteDepuis: Date | null;
  dettePointsDus: number;
};

export type LigneClassement = {
  id: string;
  pseudo: string;
  /** Points d'effort payés sur la fenêtre. */
  points: number;
  rang: number;
  /** Vrai pour la ligne de celui qui regarde. */
  moi: boolean;
  enRetard: boolean;
  joursDeRetard: number;
};

/**
 * Ordonner, et poser les rangs.
 *
 * Deux règles qui ne vont pas de soi :
 *
 *  * **à égalité, le rang est le même** (1, 2, 2, 4). Le cas courant d'un
 *    groupe qui vient de se former est que tout le monde est à zéro : les
 *    numéroter de un à dix désignerait un dernier pour rien, et ce dernier est
 *    exactement celui qu'on veut voir revenir ;
 *  * **à égalité, l'ordre est celui des pseudos.** Sans second critère, l'ordre
 *    est celui que la base rend, qui n'est garanti par rien : la liste saute
 *    d'un rechargement à l'autre et on croit avoir été dépassé.
 */
export function classer(
  comptes: CompteClasse[],
  points: Map<string, number>,
  moiId: string,
  maintenant: Date = new Date(),
): LigneClassement[] {
  const lignes = comptes.map((c) => {
    const retard = etatRetard(c.detteDepuis, c.dettePointsDus, maintenant);
    return {
      id: c.id,
      // Le nom montré aux autres, pas celui du compte : réponse 128.
      pseudo: nomPublie(c),
      points: Math.max(0, Math.round(points.get(c.id) ?? 0)),
      rang: 0,
      moi: c.id === moiId,
      enRetard: retard.enRetard,
      joursDeRetard: retard.jours,
    };
  });

  lignes.sort((a, b) =>
    b.points - a.points || a.pseudo.localeCompare(b.pseudo) || a.id.localeCompare(b.id));

  let rang = 0;
  let precedent: number | null = null;
  lignes.forEach((l, i) => {
    if (precedent === null || l.points !== precedent) rang = i + 1;
    precedent = l.points;
    l.rang = rang;
  });
  return lignes;
}

/**
 * Ce que le classement dit de la semaine, pour celui qui le regarde.
 *
 * Un tableau seul ne dit rien à qui est troisième sur quatre. La phrase qui
 * l'accompagne se calcule ici, et pas à l'écran : elle dépend de l'écart au
 * premier, qui est la seule chose sur laquelle on puisse encore agir.
 */
export function ecartAuPremier(lignes: LigneClassement[]): number | null {
  const moi = lignes.find((l) => l.moi);
  if (!moi || lignes.length === 0) return null;
  return Math.max(0, lignes[0].points - moi.points);
}

/**
 * Depuis combien de jours la fenêtre court, pour l'annoncer.
 *
 * Exposée pour que l'écran n'ait pas à refaire la soustraction — c'est la
 * septième fois sur ce projet qu'une règle recopiée à l'affichage diverge de
 * celle du calcul.
 */
export function longueurFenetre(debut: Jour, aujourdhui: Jour): number {
  return ecartEnJours(debut, aujourdhui) + 1;
}
