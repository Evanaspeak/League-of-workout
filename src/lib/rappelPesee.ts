/**
 * Faut-il rappeler à quelqu'un de se peser ? (réponse 022, « rappel
 * hebdomadaire optionnel »).
 *
 * La décision vit ici plutôt que dans la route, comme celle de la relance des
 * absents : elle tient en trois conditions, et chacune protège de quelque
 * chose qu'on ne peut pas rattraper une fois le message parti.
 *
 * ## Les trois conditions, et pourquoi chacune
 *
 * **Le réglage est allumé.** Il est éteint par défaut (réponse 022 : le rappel
 * est OPTIONNEL). Envoyer une notification de suivi de poids à quelqu'un qui
 * ne l'a pas demandée n'est pas une maladresse, c'est un sujet sur lequel on
 * n'a aucune latitude.
 *
 * **La dernière pesée date d'au moins sept jours.** Rappeler à quelqu'un qui
 * s'est pesé hier lui apprend qu'on ne regarde pas ce qu'il fait.
 *
 * **Le dernier rappel date d'au moins sept jours.** Sans ça, le rappel
 * repartirait CHAQUE matin de la semaine suivante — le défaut déjà écrit au
 * journal pour la relance des absents : « une application qui redit tous les
 * jours "tu nous manques" se fait couper, et elle l'a cherché ».
 *
 * ## Ce que ce module ne décide PAS
 *
 * Ni l'heure ni la fenêtre : `dansLaFenetreDuMatin` s'en charge, et l'écrire
 * deux fois ferait diverger les deux règles à la première correction. Ni le
 * fuseau : c'est la route qui sait le lire.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Sept jours : la maille d'une pesée, et celle du rappel. */
export const JOURS_ENTRE_PESEES = 7;

export type EtatRappelPesee = {
  actif: boolean;
  /** Jour de la dernière pesée, « AAAA-MM-JJ », ou `null` si jamais pesé. */
  dernierePesee: string | null;
  /** Quand le dernier rappel est parti, ou `null`. */
  dernierRappel: Date | null;
  /** Quand le compte a été créé : sert quand il n'y a aucune pesée. */
  creeLe: Date;
};

export function rappelerPesee(etat: EtatRappelPesee, maintenant: Date = new Date()): boolean {
  if (!etat.actif) return false;

  /**
   * Sans aucune pesée, on compte depuis l'OUVERTURE DU COMPTE.
   *
   * Rendre `true` d'emblée enverrait un rappel le matin même où quelqu'un
   * allume le réglage, avant qu'il ait eu l'occasion de se peser une première
   * fois — ce qui se lit comme un reproche pour une chose qu'on vient de
   * demander. Rendre `false` pour toujours, à l'inverse, rendrait le réglage
   * inopérant précisément pour celui qui en a le plus besoin.
   */
  const reference = etat.dernierePesee ? Date.parse(`${etat.dernierePesee}T12:00:00Z`) : etat.creeLe.getTime();
  if (!Number.isFinite(reference)) return false;
  if ((maintenant.getTime() - reference) / JOUR_MS < JOURS_ENTRE_PESEES) return false;

  if (!etat.dernierRappel) return true;
  return (maintenant.getTime() - etat.dernierRappel.getTime()) / JOUR_MS >= JOURS_ENTRE_PESEES;
}
