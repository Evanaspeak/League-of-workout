import { EXERCICES, type ExerciceId } from "@/lib/exercices";

/**
 * Ce qu'une séance montre, et à quel moment (ligne 205 du plan).
 *
 * Réponse 205, renversée le 8 septembre : « fais-le ». Un mode séance plein
 * écran pour le téléphone — gros chiffre, compteur de répétitions.
 *
 * La fenêtre existait déjà et occupait bien l'écran entier. Ce qui manquait se
 * mesure, et c'est ce qui a décidé de tout ce qui suit.
 *
 * **Le chrono démarrait à l'OUVERTURE de la fenêtre, sur le même écran que les
 * consignes d'exécution.** Mesuré sur un téléphone de 390 px, une dette de
 * boxe de 1 min 15 : quinze secondes passées à LIRE, sans un seul coup de
 * poing, ont ramené la dette à une minute. **Un cinquième de la dette payé
 * pour avoir lu.** Sur un produit dont tout le sujet est que la dette est
 * réelle, c'est le seul défaut qu'on ne peut pas laisser.
 *
 * D'où deux temps, et pas deux fenêtres : on se PRÉPARE — le total, l'exercice,
 * comment le faire, la prudence, l'échauffement, ce vers quoi on peut
 * convertir — puis on COMMENCE. Rien ne compte avant le geste.
 *
 * Et pendant la séance, le chiffre a l'écran pour lui. Soixante-treize mots
 * étaient affichés à côté d'un chrono qui tourne ; ils ont été lus, ils n'ont
 * plus rien à dire, et on regarde ce compteur à bout de bras.
 */

/** Les deux temps d'une séance. */
export type TempsSeance = "preparation" | "encours";

/**
 * L'exercice sur lequel la séance COMPTE, ou `null` s'il n'y a rien à compter.
 *
 * Le compteur de répétitions n'existait que pour les CONVERSIONS : quelqu'un
 * qui doit trente-huit pompes n'avait que « c'est fait » ou « plus tard »,
 * c'est-à-dire tout ou rien, pendant que celui qui convertissait dix minutes
 * de boxe en pompes obtenait un compteur et un paiement partiel. Le
 * raisonnement d'origine était « sans chrono, il n'y a rien à mesurer : on a
 * fait ses pompes ou on ne les a pas faites » — et c'est faux dès que le
 * nombre dépasse une série, ce qui est le cas courant.
 *
 * La séance compte donc ce qu'on DOIT quand la dette tient dans un seul
 * exercice qui se compte, et ce vers quoi on convertit sinon. C'est le même
 * chemin de paiement — `payer({ quantite, exercice })` — et donc aucune
 * seconde règle côté serveur.
 *
 * Une dette répartie sur PLUSIEURS exercices n'a pas de cible évidente : la
 * compter sur l'un des deux paierait l'autre sans qu'on l'ait fait. Elle passe
 * par la conversion, qui existe exactement pour regrouper.
 */
export function exerciceCompte(
  dus: ExerciceId[],
  conversion: ExerciceId | null,
): ExerciceId | null {
  if (conversion) return conversion;
  if (dus.length !== 1) return null;
  const seul = dus[0];
  // Un exercice compté au TEMPS se chronomètre, il ne se tape pas.
  return EXERCICES[seul].unite === "temps" ? null : seul;
}

/**
 * Le verrou de veille est-il demandé ?
 *
 * Un téléphone s'éteint au bout de trente secondes. Une planche de cinq
 * minutes se fait donc devant un écran noir, qu'il faut déverrouiller les
 * mains moites pour savoir où l'on en est — et personne ne le signalera
 * jamais, parce que ça ressemble à un téléphone qui fait ce qu'un téléphone
 * fait.
 *
 * On ne le demande que PENDANT la séance : garder un écran allumé sur une page
 * qu'on ne regarde pas est une pile qu'on vide pour rien.
 *
 * Ce n'est pas mesurable ici — un Chromium sans tête ne s'endort pas — et
 * c'est écrit plutôt que présenté comme éprouvé.
 */
export function veilleADemander(temps: TempsSeance, chronoOuvert: boolean): boolean {
  return chronoOuvert && temps === "encours";
}
