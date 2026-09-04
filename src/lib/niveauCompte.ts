/**
 * Le niveau de compte, et le titre qui va avec.
 *
 * Lignes 148 et 149 du plan, toutes deux répondues « oui ». Elles vont
 * ensemble : le niveau dit COMBIEN, le titre dit QUOI — et les deux se
 * déduisent des mêmes chiffres, déjà lus par ce qui les affiche.
 *
 * **Rien n'est stocké**, exactement comme les paliers. Un niveau rangé en base
 * finit par diverger de ce qu'il prétend décrire le jour où une partie est
 * supprimée : on aurait alors un chiffre qui ne correspond plus à rien et que
 * personne ne saurait recalculer. La contrepartie est qu'un niveau peut
 * BAISSER — c'est le prix, il est assumé, et c'est déjà le cas des paliers.
 *
 * **Le niveau se calcule sur l'effort PAYÉ**, jamais sur les parties jouées ni
 * sur la dette due. C'est la décision déjà prise pour le classement (réponse
 * 115) et elle vaut pour la même raison : quelqu'un qui perd beaucoup accumule
 * beaucoup de dette, donc classer sur les parties reviendrait à faire monter
 * celui qui ne paie pas. Sur un produit dont le sujet est de payer, ce serait
 * l'exact contresens.
 */

/**
 * **`pointsPayes`, et surtout pas `totalPoints`.**
 *
 * Le premier jet réemployait `SourceBadges`, au motif que les deux formes se
 * ressemblent trait pour trait. C'était faux, et le sabotage l'a dit : le
 * `totalPoints` des paliers est l'effort GÉNÉRÉ — ce que les parties ont
 * coûté — tandis que le niveau se calcule sur l'effort PAYÉ. Le module
 * annonçait « payé » et la route lui passait « généré », sans qu'aucun test
 * puisse les distinguer, puisqu'ils portaient le même nom.
 *
 * Deux formes identiques ne sont pas la même chose quand l'une compte ce
 * qu'on doit et l'autre ce qu'on a fait. Le champ est donc renommé : c'est le
 * NOM qui empêche la confusion, pas le commentaire.
 */
export type SourceNiveau = {
  /** Points d'effort réellement PAYÉS, depuis toujours. */
  pointsPayes: number;
  /** Parties enregistrées. */
  parties: number;
  /** Plus longue série de jours payés. */
  meilleureSerie: number;
  /** Nombre de jours distincts où quelque chose a été payé. */
  joursPayes: number;
};

/**
 * Le pas de la courbe.
 *
 * Le niveau n coûte `25 × n × (n−1)` points au total : 0, 50, 150, 300, 500,
 * puis 2 250 au niveau 10, 9 500 au niveau 20, 24 800 au niveau 32. La forme
 * est quadratique, et c'est le seul choix qui tienne aux deux bouts — un pas
 * constant rend les niveaux tardifs gratuits, une courbe exponentielle les
 * rend inatteignables et le compteur s'arrête de bouger.
 *
 * Le repère : 25 000 points est le dernier palier de volume, et il tombe au
 * niveau 32. Les deux échelles disent donc la même chose, ce qui n'est pas un
 * hasard mais un calage.
 */
export const PAS_NIVEAU = 25;

/** Ce qu'il faut avoir payé, en tout, pour ATTEINDRE le niveau n. */
export function seuilDuNiveau(n: number): number {
  if (!Number.isFinite(n) || n <= 1) return 0;
  const entier = Math.floor(n);
  return PAS_NIVEAU * entier * (entier - 1);
}

/**
 * Le niveau que valent ces points.
 *
 * **La forme fermée suffit, et c'est l'algèbre qui le dit.** Le réflexe était
 * d'ajouter une correction par comparaison, au motif qu'une racine carrée
 * flottante peut rendre 2,9999997 au seuil exact — donc précisément à
 * l'instant qu'on veut fêter. Cette correction a été écrite, puis sabotée : la
 * retirer ne faisait tomber aucun test. Elle ne tenait rien, et elle se
 * relisait comme une garantie.
 *
 * La raison est que ce cas ne peut pas se produire ici. Au seuil du niveau n,
 * `points` vaut `25 n (n−1)`, donc `1 + 4 points / 25` vaut `4n² − 4n + 1`,
 * c'est-à-dire `(2n − 1)²` : un carré parfait entier. La division par 25 est
 * exacte (le quotient est représentable), et la racine d'un carré parfait est
 * exacte en IEEE 754. Il n'y a donc pas d'erreur à rattraper AU seuil, et
 * entre deux seuils l'erreur ne peut pas atteindre la borne du plancher.
 *
 * Ce n'est pas un raisonnement qu'on croit sur parole : le test le vérifie sur
 * trois cent mille niveaux, et c'est LUI la garantie.
 */
export function niveauPourPoints(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 1;
  const n = Math.floor((1 + Math.sqrt(1 + (4 * points) / PAS_NIVEAU)) / 2);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export type Avancement = {
  niveau: number;
  /** Ce que valait l'entrée dans le niveau courant. */
  seuil: number;
  /** Ce qu'il faudra pour le suivant. */
  prochain: number;
  /** Ce qu'il reste à payer. */
  restant: number;
  /** Où l'on en est dans le niveau, entre 0 et 1. */
  part: number;
};

/** De quoi dessiner une barre sans refaire le calcul à l'écran. */
export function avancementNiveau(points: number): Avancement {
  const propres = Number.isFinite(points) ? Math.max(0, points) : 0;
  const niveau = niveauPourPoints(propres);
  const seuil = seuilDuNiveau(niveau);
  const prochain = seuilDuNiveau(niveau + 1);
  const largeur = prochain - seuil;
  return {
    niveau,
    seuil,
    prochain,
    restant: Math.max(0, prochain - propres),
    // Une largeur nulle n'existe pas sur cette courbe, mais une division par
    // zéro rendrait NaN, et NaN traverse une barre de progression sans bruit.
    part: largeur > 0 ? Math.min(1, Math.max(0, (propres - seuil) / largeur)) : 0,
  };
}

/**
 * Les titres, du plus facile au plus rare.
 *
 * **Aucun n'est désobligeant, et c'est une règle.** Un titre s'affiche à côté
 * du pseudo, donc devant quelqu'un d'autre : « Débutant » ou « En retard »
 * feraient du produit celui qui vous désigne publiquement. Quelqu'un qui n'a
 * rien gagné n'a donc PAS de titre — pas un titre qui dit qu'il n'a rien fait.
 *
 * **L'ordre est celui du temps qu'ils demandent**, pas celui d'un chiffre :
 * sept jours d'affilée sont plus durs que dix jours épars, et c'est ce qui les
 * sépare. C'est aussi ce qui rend l'ordre stable : sans lui, on afficherait le
 * dernier gagné, et le titre changerait à chaque partie.
 */
export const TITRES = [
  { cle: "premierPas", tient: (s: SourceNiveau) => s.parties >= 1 },
  { cle: "repenti", tient: (s: SourceNiveau) => s.joursPayes >= 10 },
  { cle: "regulier", tient: (s: SourceNiveau) => s.meilleureSerie >= 7 },
  { cle: "endurant", tient: (s: SourceNiveau) => s.pointsPayes >= 5000 },
  { cle: "increvable", tient: (s: SourceNiveau) => s.meilleureSerie >= 30 },
  { cle: "machine", tient: (s: SourceNiveau) => s.pointsPayes >= 25000 },
] as const;

export type CleTitre = (typeof TITRES)[number]["cle"];

/** Tous les titres, gagnés ou non, dans l'ordre où on les gagne. */
export function tousLesTitres(source: SourceNiveau): { cle: CleTitre; obtenu: boolean }[] {
  return TITRES.map((t) => ({ cle: t.cle, obtenu: t.tient(source) }));
}

/**
 * Le titre qu'on porte : le plus rare de ceux qu'on a.
 *
 * Un seul, parce que plusieurs à côté d'un pseudo ne se lisent plus. `null`
 * quand il n'y en a aucun, et c'est un cas normal — pas une valeur par défaut
 * à inventer.
 */
export function titrePorte(source: SourceNiveau): CleTitre | null {
  let porte: CleTitre | null = null;
  for (const t of TITRES) if (t.tient(source)) porte = t.cle;
  return porte;
}
