/**
 * Le niveau de souffrance : ce que le corps a réellement encaissé.
 *
 * Demandé par le propriétaire du produit, et pour une raison qu'il a formulée
 * en une phrase : « comme ça on a une distinction avec le niveau de compte ».
 * Elle vient d'un vrai malentendu, le sien, sur son propre tableau de bord — il
 * a lu « 900 » sur l'écran, cru que c'étaient ses pompes, et n'a pas compris
 * pourquoi il restait niveau 5. Le mot « activité » désignait une PARTIE ; le
 * chiffre qu'il regardait était de la dette, en pompes. Deux unités, un seul
 * compteur affiché.
 *
 * ## Ce qu'il compte, et ce qu'il ne compte pas
 *
 * **L'effort PAYÉ, et lui seul.** Pas ce que les parties ont coûté : une dette
 * qu'on accumule sans jamais la rendre ne fait souffrir personne. C'est la même
 * distinction que `pointsPayes` contre `totalPoints`, et c'est elle qui donne
 * son sens au mot : on ne souffre pas de ce qu'on doit, on souffre de ce qu'on
 * fait.
 *
 * Un point d'effort vaut une pompe depuis le premier jour, quel que soit
 * l'exercice choisi : les squats, la boxe et la course se convertissent dans
 * cette unité avant d'entrer au registre. Le niveau de souffrance est donc
 * comparable d'une personne à l'autre, même quand elles ne font pas le même
 * exercice.
 *
 * ## Ce qu'il partage avec le niveau de compte, et qui est assumé
 *
 * Le niveau de COMPTE compte aussi l'effort payé, à raison d'un point d'XP par
 * point. Les deux se recouvrent donc sur ce terme. C'est délibéré : le niveau
 * de compte répond à « depuis combien de temps tu es là », le niveau de
 * souffrance à « qu'est-ce que tu as vraiment fait ». Un compte qui joue
 * beaucoup sans jamais payer monte sur le premier et reste à zéro sur le
 * second, et c'est exactement la distinction demandée.
 *
 * Rien n'est stocké, comme pour le niveau de compte : le chiffre se recalcule à
 * chaque lecture depuis les paiements. Un total rangé en base finirait par
 * diverger de ce qui le produit.
 */

/**
 * Le pas de la courbe, en POINTS d'effort — donc en pompes.
 *
 * Le niveau n demande `50 × n × (n−1)` points au total : cent pompes pour le
 * niveau 2, trois cents pour le 3, six cents pour le 4, mille pour le 5. Cent
 * pompes, c'est deux ou trois défaites payées : le compteur bouge dès les
 * premiers soirs, ce qui est la seule façon qu'il serve à quelque chose.
 *
 * Même forme que le niveau de compte, et pour la même raison : un pas constant
 * rend les niveaux tardifs gratuits, une courbe exponentielle les rend
 * inatteignables et le compteur s'arrête de bouger.
 */
export const PAS_SOUFFRANCE = 50;

/** Ce qu'il faut avoir PAYÉ, en tout, pour atteindre le niveau n. */
export function seuilSouffrance(n: number): number {
  if (!Number.isFinite(n) || n <= 1) return 0;
  const entier = Math.floor(n);
  return PAS_SOUFFRANCE * entier * (entier - 1);
}

/**
 * Le niveau que valent ces points payés.
 *
 * Forme fermée, et la démonstration est celle du niveau de compte : au seuil du
 * niveau n, `1 + 4 points / PAS` vaut `(2n − 1)²`, un carré parfait, dont la
 * racine est exacte en IEEE 754. Un test la vérifie sur trois cent mille
 * niveaux plutôt que de la croire sur parole.
 *
 * Le plancher est porté par la SEULE ligne de retour, et c'est écrit ici parce
 * que la garde d'entrée qu'on aurait envie d'ajouter au-dessus — `points <= 0`,
 * `!Number.isFinite(points)` — ne tient rien : zéro donne `n = 1`, un négatif
 * donne `NaN` par la racine, l'infini donne `Infinity`, et les trois retombent
 * sur 1 par la condition finale. Elle a été écrite, sabotée, et retirée : une
 * ligne qu'on peut enlever sans qu'un test tombe se relit comme une garantie
 * alors qu'elle ne garde rien.
 */
export function souffrancePourPoints(points: number): number {
  const n = Math.floor((1 + Math.sqrt(1 + (4 * points) / PAS_SOUFFRANCE)) / 2);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export type AvancementSouffrance = {
  niveau: number;
  /** Points d'effort payés depuis toujours. */
  points: number;
  seuil: number;
  prochain: number;
  /** Ce qu'il reste à payer pour le niveau suivant. */
  restant: number;
  /** Où l'on en est dans le niveau, entre 0 et 1. */
  part: number;
};

/**
 * L'avancement, à partir des points PAYÉS.
 *
 * Elle prend un nombre et non une source, contrairement à `avancementNiveau` :
 * il n'y a qu'un seul chiffre qui puisse entrer ici, et il porte son nom chez
 * l'appelant. Le risque que le nommage évitait là-bas — passer l'effort généré
 * au lieu du payé — se traite ici par le NOM du paramètre et par le test de
 * route, qui donne deux valeurs assez éloignées pour qu'aucune confusion ne
 * passe.
 */
export function avancementSouffrance(pointsPayes: number): AvancementSouffrance {
  const points = Number.isFinite(pointsPayes) ? Math.max(0, Math.floor(pointsPayes)) : 0;
  const niveau = souffrancePourPoints(points);
  const seuil = seuilSouffrance(niveau);
  const prochain = seuilSouffrance(niveau + 1);
  const largeur = prochain - seuil;
  return {
    niveau,
    points,
    seuil,
    prochain,
    restant: Math.max(0, prochain - points),
    // Une largeur nulle n'existe pas sur cette courbe ; une division par zéro
    // rendrait NaN, et NaN traverse une barre de progression sans bruit.
    part: largeur > 0 ? Math.min(1, Math.max(0, (points - seuil) / largeur)) : 0,
  };
}
