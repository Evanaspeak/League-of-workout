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
