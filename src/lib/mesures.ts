/**
 * Les mesures d'usage, calculées à part de la base.
 *
 * Deux questions du questionnaire, restées sans réponse faute d'instrument :
 * combien de temps entre l'inscription et la première partie, et combien de
 * personnes reviennent. La première prédit mieux que tout si quelqu'un reste ;
 * la seconde dit si le produit sert à quelque chose.
 *
 * Le calcul vit ici et non dans la route pour qu'il soit éprouvable sans base :
 * une statistique fausse ne se voit pas, elle se croit.
 */

export type CompteMesure = {
  /** Inscription. */
  cree: Date;
  /** Date d'ENREGISTREMENT de la première partie, jamais la date de la partie. */
  premierePartie: Date | null;
  /** Jours distincts où au moins une partie a été enregistrée. */
  joursActifs: number;
};

export type Mesures = {
  comptes: number;
  avecPartie: number;
  /** Part des comptes qui ont enregistré au moins une partie, en pourcentage. */
  partActifs: number;
  /** Délais jusqu'à la première partie, en minutes. */
  delai: { median: number | null; p25: number | null; p75: number | null };
  /** Comptes ayant enregistré une partie dans les 24 h, puis dans les 7 jours. */
  dansLaJournee: number;
  dansLaSemaine: number;
  /** Comptes revenus : au moins deux jours distincts avec une partie. */
  revenus: number;
};

/**
 * Quantile d'une série, par interpolation linéaire.
 *
 * La médiane d'un nombre pair de valeurs est la moyenne des deux du milieu, et
 * non la valeur du bas : sur cinq utilisateurs, prendre la mauvaise déplace le
 * résultat de plusieurs heures.
 */
export function quantile(valeurs: number[], q: number): number | null {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  if (tri.length === 1) return tri[0];
  const position = (tri.length - 1) * Math.min(1, Math.max(0, q));
  const bas = Math.floor(position);
  const haut = Math.ceil(position);
  if (bas === haut) return tri[bas];
  return tri[bas] + (tri[haut] - tri[bas]) * (position - bas);
}

const MINUTE = 60_000;

export function calculerMesures(comptes: CompteMesure[]): Mesures {
  const total = comptes.length;
  const actifs = comptes.filter((c) => c.premierePartie !== null);

  /**
   * Un délai négatif n'est pas une donnée, c'est un défaut.
   *
   * Il en existe : les parties enregistrées avant que la date d'enregistrement
   * ne soit distinguée de la date de partie ont repris cette dernière, qui peut
   * précéder l'inscription. On les écarte plutôt que de les compter à zéro, ce
   * qui tirerait la médiane vers le bas sans qu'on le voie.
   */
  const delais = actifs
    .map((c) => (c.premierePartie!.getTime() - c.cree.getTime()) / MINUTE)
    .filter((d) => d >= 0);

  const arrondi = (n: number | null) => (n === null ? null : Math.round(n));

  return {
    comptes: total,
    avecPartie: actifs.length,
    partActifs: total === 0 ? 0 : Math.round((actifs.length / total) * 100),
    delai: {
      median: arrondi(quantile(delais, 0.5)),
      p25: arrondi(quantile(delais, 0.25)),
      p75: arrondi(quantile(delais, 0.75)),
    },
    dansLaJournee: delais.filter((d) => d <= 24 * 60).length,
    dansLaSemaine: delais.filter((d) => d <= 7 * 24 * 60).length,
    revenus: comptes.filter((c) => c.joursActifs >= 2).length,
  };
}

/** « 3 min », « 2 h 10 », « 4 j ». Une durée se lit, elle ne se divise pas. */
export function formaterDelai(minutes: number | null): string {
  if (minutes === null) return "—";
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) {
    const h = Math.floor(m / 60);
    const reste = m % 60;
    return reste === 0 ? `${h} h` : `${h} h ${String(reste).padStart(2, "0")}`;
  }
  const jours = Math.floor(m / (24 * 60));
  const heures = Math.round((m % (24 * 60)) / 60);
  return heures === 0 ? `${jours} j` : `${jours} j ${heures} h`;
}

/**
 * Un jeu paie-t-il deux fois plus qu'un autre ? (réponse 185)
 *
 * Le barème est le même pour tous les jeux, mais leurs formes ne le sont pas :
 * un battle royale à cent joueurs distribue autrement qu'un MOBA à cinq, et
 * rien ne garantit que les deux coûtent le même effort pour une soirée
 * équivalente. Si l'écart dérape, les gens joueront au jeu le moins cher — ce
 * qui n'est pas ce que le produit demande.
 *
 * Trois règles, chacune avec sa raison :
 *
 * - **on ne compare que les jeux comptés à la PARTIE.** Un jeu compté au temps
 *   coûte une fonction de sa durée : le comparer au coût d'un match reviendrait
 *   à comparer une soirée entière à dix minutes. C'est à l'appelant de filtrer,
 *   et le type le dit ;
 * - **en dessous d'un plancher de parties, un jeu est listé mais pas comparé.**
 *   Une seule partie malheureuse décide sinon du facteur, et l'alerte se
 *   déclenche sur du bruit ;
 * - **un jeu dont la moyenne est nulle ne divise pas.** Le facteur n'a alors
 *   pas de valeur, et rendre `Infinity` ferait crier l'écran sans rien dire.
 */
export const PARTIES_MIN_COMPARAISON = 10;

/** Au-delà de ce facteur, l'écart mérite qu'on regarde. C'est la réponse 185. */
export const FACTEUR_ALERTE = 2;

export type CoutJeu = { jeu: string; parties: number; moyenne: number };

export type EquilibreJeux = {
  /** Tous les jeux vus, du plus cher au moins cher. */
  jeux: CoutJeu[];
  /** Combien d'entre eux ont assez de parties pour être comparés. */
  compares: number;
  /** Rapport entre le plus cher et le moins cher des comparés. */
  facteur: number | null;
  /** Vrai quand ce rapport atteint le seuil. */
  derape: boolean;
};

export function equilibreJeux(lignes: CoutJeu[]): EquilibreJeux {
  const jeux = [...lignes].sort((a, b) => b.moyenne - a.moyenne);
  const assez = jeux.filter((j) => j.parties >= PARTIES_MIN_COMPARAISON);
  const moyennes = assez.map((j) => j.moyenne);
  const bas = moyennes.length ? Math.min(...moyennes) : 0;
  const haut = moyennes.length ? Math.max(...moyennes) : 0;
  // Il faut DEUX jeux pour un rapport, et un dénominateur qui ne soit pas nul.
  const facteur = assez.length >= 2 && bas > 0
    ? Math.round((haut / bas) * 100) / 100
    : null;
  return { jeux, compares: assez.length, facteur, derape: facteur !== null && facteur >= FACTEUR_ALERTE };
}
