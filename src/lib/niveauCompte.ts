/**
 * Le niveau de compte, le titre qui va avec, et l'XP qui les nourrit.
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
 * ## Le niveau vient de l'XP, et plus du seul effort payé
 *
 * La première version calculait le niveau sur l'effort PAYÉ et sur lui seul,
 * pour une raison qui reste bonne : quelqu'un qui perd beaucoup accumule
 * beaucoup de dette, et faire monter celui qui ne paie jamais serait le
 * contresens d'un produit dont le sujet est de payer.
 *
 * Elle avait un défaut que seul l'usage pouvait montrer : **à neuf cent
 * soixante parties enregistrées et deux points payés, on restait niveau un.**
 * Le compteur ne bougeait donc jamais pour la personne la plus assidue du
 * produit, et un niveau qui ne bouge pas n'est pas un niveau. C'est le
 * propriétaire du produit qui l'a constaté sur son propre compte, et qui a
 * tranché : le niveau se calcule sur de l'XP, « ça fait plus jeu vidéo ».
 *
 * **Ce que ça coûte, et il faut le dire.** Jouer rapporte maintenant de l'XP
 * quel que soit le résultat : perdre fait donc monter. Ce n'est plus le garde
 * que la première version posait. Ce qui le remplace est un RAPPORT plutôt
 * qu'une porte — un point d'effort payé rapporte autant qu'un dixième
 * d'activité, donc une défaite de vingt points payée rapporte trente d'XP
 * contre dix si on ne la paie jamais. Payer reste de très loin le chemin le
 * plus rapide ; ça n'est simplement plus le seul.
 */

/** Ce que rapporte une activité enregistrée, quel qu'en soit le résultat. */
export const XP_PAR_ACTIVITE = 10;

/** Ce que rapporte, EN PLUS, chaque point d'effort réellement payé. */
export const XP_PAR_POINT_PAYE = 1;

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
 * qu'on doit et l'autre ce qu'on a fait. Le champ est donc nommé : c'est le
 * NOM qui empêche la confusion, pas le commentaire.
 */
export type SourceNiveau = {
  /** Points d'effort réellement PAYÉS, depuis toujours. */
  pointsPayes: number;
  /** Activités enregistrées, sans enjeu exclues. */
  parties: number;
  /** Plus longue série de jours payés. */
  meilleureSerie: number;
  /** Nombre de jours distincts où quelque chose a été payé. */
  joursPayes: number;
};

/** Un compte n'a pas d'XP négative, et une source incomplète vaut zéro. */
function entierSain(valeur: number): number {
  return Number.isFinite(valeur) && valeur > 0 ? valeur : 0;
}

/**
 * L'XP d'un compte, déduite et jamais stockée.
 *
 * Les deux termes ne mesurent pas la même chose et c'est voulu : le premier
 * compte ce qu'on a JOUÉ, le second ce qu'on a PAYÉ. Les additionner donne un
 * compteur qui avance quoi qu'il arrive, et qui avance beaucoup plus vite
 * quand on s'acquitte.
 */
export function xpDuCompte(source: SourceNiveau): number {
  return XP_PAR_ACTIVITE * entierSain(source.parties)
    + XP_PAR_POINT_PAYE * entierSain(source.pointsPayes);
}

/**
 * Le pas de la courbe.
 *
 * Le niveau n coûte `50 × n × (n−1)` d'XP au total. Traduit en activités, à
 * dix d'XP l'unité, ça donne exactement les repères demandés : **dix activités
 * pour le niveau 2, trente pour le 3, soixante pour le 4, cent pour le 5.**
 * Les paliers s'écartent ensuite de dix activités à chaque fois, ce qui garde
 * un niveau atteignable très longtemps sans les rendre gratuits.
 *
 * La forme reste quadratique, et c'est le seul choix qui tienne aux deux
 * bouts — un pas constant rend les niveaux tardifs gratuits, une courbe
 * exponentielle les rend inatteignables et le compteur s'arrête de bouger,
 * c'est-à-dire précisément le défaut qu'on vient de corriger.
 */
export const PAS_NIVEAU = 50;

/** Ce qu'il faut avoir d'XP, en tout, pour ATTEINDRE le niveau n. */
export function seuilDuNiveau(n: number): number {
  if (!Number.isFinite(n) || n <= 1) return 0;
  const entier = Math.floor(n);
  return PAS_NIVEAU * entier * (entier - 1);
}

/**
 * Le niveau que vaut cette XP.
 *
 * **La forme fermée suffit, et c'est l'algèbre qui le dit.** Le réflexe était
 * d'ajouter une correction par comparaison, au motif qu'une racine carrée
 * flottante peut rendre 2,9999997 au seuil exact — donc précisément à
 * l'instant qu'on veut fêter. Cette correction a été écrite, puis sabotée : la
 * retirer ne faisait tomber aucun test. Elle ne tenait rien, et elle se
 * relisait comme une garantie.
 *
 * La raison est que ce cas ne peut pas se produire ici, et le changement de
 * pas n'y change rien. Au seuil du niveau n, l'XP vaut `PAS × n (n−1)`, donc
 * `1 + 4 xp / PAS` vaut `4n² − 4n + 1`, c'est-à-dire `(2n − 1)²` : un carré
 * parfait entier, quel que soit le pas. La racine d'un carré parfait est
 * exacte en IEEE 754.
 *
 * Ce n'est pas un raisonnement qu'on croit sur parole : le test le vérifie sur
 * trois cent mille niveaux, et c'est LUI la garantie.
 */
export function niveauPourXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  const n = Math.floor((1 + Math.sqrt(1 + (4 * xp) / PAS_NIVEAU)) / 2);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export type Avancement = {
  niveau: number;
  /** L'XP totale du compte, pour l'afficher telle quelle. */
  xp: number;
  /** Ce que valait l'entrée dans le niveau courant. */
  seuil: number;
  /** Ce qu'il faudra pour le suivant. */
  prochain: number;
  /** L'XP qu'il reste à gagner. */
  restant: number;
  /** Où l'on en est dans le niveau, entre 0 et 1. */
  part: number;
};

/** L'arithmétique seule, sur une XP déjà calculée. */
export function avancementPourXp(xp: number): Avancement {
  const propres = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const niveau = niveauPourXp(propres);
  const seuil = seuilDuNiveau(niveau);
  const prochain = seuilDuNiveau(niveau + 1);
  const largeur = prochain - seuil;
  return {
    niveau,
    xp: propres,
    seuil,
    prochain,
    restant: Math.max(0, prochain - propres),
    // Une largeur nulle n'existe pas sur cette courbe, mais une division par
    // zéro rendrait NaN, et NaN traverse une barre de progression sans bruit.
    part: largeur > 0 ? Math.min(1, Math.max(0, (propres - seuil) / largeur)) : 0,
  };
}

/**
 * De quoi dessiner une barre sans refaire le calcul à l'écran.
 *
 * **Elle prend la SOURCE et pas un nombre**, et c'est délibéré. La version
 * d'avant recevait un nombre, et le sabotage avait montré qu'on pouvait lui
 * passer l'effort généré à la place de l'effort payé sans qu'aucun test ne
 * puisse les distinguer. Avec la source entière, il n'y a plus de mauvais
 * nombre à passer : c'est le module qui décide ce que vaut un compte.
 */
export function avancementNiveau(source: SourceNiveau): Avancement {
  return avancementPourXp(xpDuCompte(source));
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
 *
 * **Ils restent sur l'effort PAYÉ là où ils en emploient un**, alors que le
 * niveau n'en dépend plus. Ce n'est pas une incohérence : le niveau dit qu'on
 * est là depuis longtemps, le titre dit ce qu'on a fait de dur. « Endurant »
 * doit rester quelque chose qu'on ne gagne pas en perdant.
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
