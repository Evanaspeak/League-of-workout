import { meilleureSerie, type Jour } from "./serie";

/**
 * Le bilan d'une saison.
 *
 * L'application ne sait dire que le présent : ce qu'on doit, là, maintenant.
 * Trois mois mis bout à bout disent autre chose — et c'est la seule chose
 * qu'on ait envie de montrer à quelqu'un.
 *
 * Le calcul vit ici, hors de la route, pour deux raisons : la page et l'image
 * le lisent tous les deux, et une règle posée dans une seule des deux finit
 * par ne valoir que pour l'une d'elles. Cette divergence-là a déjà coûté une
 * soirée dans cette application.
 */

/**
 * Longueur d'une saison, en jours.
 *
 * Quatre-vingt-dix jours : c'est l'ordre de grandeur d'un split classé chez
 * Riot, et c'est une durée qui a du contenu à montrer sans remonter à des
 * parties qu'on ne se rappelle plus. Ce n'est PAS la vraie date de fin de
 * saison — l'application ne la connaît pas, et aller la chercher la lierait au
 * calendrier d'un seul jeu alors qu'elle en suit une quinzaine.
 */
export const JOURS_SAISON = 90;

export type PartieBilan = {
  date: Date;
  result: string | null;
  pompesCalculees: number;
  jeu: string | null;
  champion: string | null;
};

export type PaiementBilan = { points: number; jour: Jour };

export type Bilan = {
  /** Bornes de la période, au format AAAA-MM-JJ. */
  debut: Jour;
  fin: Jour;
  parties: number;
  victoires: number;
  /** Pourcentage entier, ou `null` sans partie — zéro pour cent serait un mensonge. */
  winrate: number | null;
  /** Points d'effort produits par les parties de la période. */
  pointsDus: number;
  /** Points d'effort réellement acquittés dans la période. */
  pointsPayes: number;
  /** Jours distincts où quelque chose a été payé. */
  joursActifs: number;
  /** Plus longue suite de jours consécutifs avec un paiement. */
  meilleureSerie: number;
  /**
   * Le jour où les PARTIES ont produit le plus d'effort — c'est-à-dire la plus
   * grosse dette d'une journée, pas le plus gros paiement.
   *
   * Les deux existent, et ils portaient presque le même nom : le mur des
   * records retient le plus gros jour d'effort PAYÉ. « Journée la plus
   * chère » ne disait pas lequel des deux, sur un produit dont tout le reste
   * du registre est en effort payé. Le nom porte la règle depuis, parce qu'un
   * commentaire ne se relit pas au moment où l'on branche la valeur.
   */
  jourPlusGrosseDette: { jour: Jour; points: number } | null;
  jeuPrincipal: { nom: string; parties: number } | null;
  championPrincipal: { nom: string; parties: number } | null;
};

/** Le plus fréquent d'une liste de noms, ou `null` si elle est vide. */
function plusFrequent(noms: (string | null)[]): { nom: string; parties: number } | null {
  const comptes = new Map<string, number>();
  for (const n of noms) {
    if (!n) continue;
    comptes.set(n, (comptes.get(n) ?? 0) + 1);
  }
  let meilleur: { nom: string; parties: number } | null = null;
  for (const [nom, parties] of comptes) {
    // À égalité, le premier rencontré gagne : deux exécutions sur les mêmes
    // données doivent rendre le même bilan.
    if (!meilleur || parties > meilleur.parties) meilleur = { nom, parties };
  }
  return meilleur;
}

/**
 * @param jourDe Conversion d'une date en jour LOCAL. Elle est passée plutôt que
 *   calculée ici : le serveur ne connaît que l'heure UTC, et une partie jouée à
 *   une heure du matin basculerait sur la veille ou le lendemain selon le
 *   fuseau de la personne.
 */
export function calculerBilan(
  parties: PartieBilan[],
  paiements: PaiementBilan[],
  debut: Jour,
  fin: Jour,
  jourDe: (d: Date) => Jour,
): Bilan {
  const victoires = parties.filter((p) => p.result === "V").length;

  const parJour = new Map<Jour, number>();
  for (const p of parties) {
    const j = jourDe(p.date);
    parJour.set(j, (parJour.get(j) ?? 0) + Math.max(0, p.pompesCalculees));
  }
  let jourPlusGrosseDette: { jour: Jour; points: number } | null = null;
  for (const [jour, points] of parJour) {
    if (points > 0 && (!jourPlusGrosseDette || points > jourPlusGrosseDette.points)) jourPlusGrosseDette = { jour, points };
  }

  const joursPayes = [...new Set(paiements.filter((p) => p.points > 0).map((p) => p.jour))];

  return {
    debut,
    fin,
    parties: parties.length,
    victoires,
    winrate: parties.length > 0 ? Math.round((victoires / parties.length) * 100) : null,
    pointsDus: parties.reduce((s, p) => s + Math.max(0, p.pompesCalculees), 0),
    pointsPayes: paiements.reduce((s, p) => s + Math.max(0, p.points), 0),
    joursActifs: joursPayes.length,
    meilleureSerie: meilleureSerie(joursPayes),
    jourPlusGrosseDette,
    jeuPrincipal: plusFrequent(parties.map((p) => p.jeu)),
    championPrincipal: plusFrequent(parties.map((p) => p.champion)),
  };
}
