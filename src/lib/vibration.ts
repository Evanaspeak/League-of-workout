import { lire, ecrire } from "./stockage";

/**
 * Vibrer à chaque répétition comptée (réponse 207 : « en option »).
 *
 * **Le réglage vit dans l'APPAREIL, pas sur le compte**, et c'est la seule
 * décision de fond ici. Un téléphone vibre, un poste de bureau non : ranger ce
 * choix sur le compte le ferait voyager d'un appareil à l'autre, donc allumer
 * une option qui ne veut rien dire là où elle atterrit. C'est exactement ce
 * pour quoi le stockage du navigateur existe, et ça évite une colonne.
 *
 * **Le défaut est ÉTEINT.** « En option » veut dire qu'on peut l'allumer, pas
 * qu'elle est là : une vibration que personne n'a demandée, à chaque appui,
 * est une surprise désagréable sur l'écran où l'on compte ses pompes.
 */
export const CLE_VIBRATION = "vibrationReps";

/**
 * Vingt millisecondes : une impulsion, pas une alerte.
 *
 * On la sent sans qu'elle interrompe, et elle ne se confond pas avec une
 * notification — ce qui compte sur un écran qu'on regarde en faisant des
 * pompes, avec le téléphone posé à côté.
 */
export const DUREE_VIBRATION_MS = 20;

/** Ce que ce module demande à l'appareil, et rien d'autre. */
export type Vibreur = { vibrate?: (motif: number | number[]) => boolean };

export function vibrationActive(): boolean {
  return lire(CLE_VIBRATION) === "1";
}

export function poserVibration(actif: boolean): void {
  ecrire(CLE_VIBRATION, actif ? "1" : "0");
}

/**
 * L'appareil sait-il vibrer ?
 *
 * Safari sur iPhone ne l'implémente pas, et c'est la moitié des téléphones.
 * L'écran ne CACHE pas le réglage pour autant : il dit que l'appareil ne sait
 * pas le faire. Une case absente laisse chercher où elle est passée ; une case
 * qui explique se comprend en une lecture.
 */
export function vibrationDisponible(appareil?: Vibreur): boolean {
  return typeof appareil?.vibrate === "function";
}

/**
 * Vibre si l'option est allumée ET si l'appareil sait le faire.
 *
 * Rend ce qui s'est réellement passé plutôt que rien : une fonction qui ne dit
 * pas si elle a agi ne s'éprouve pas, et c'est ce genre de silence qui laisse
 * croire qu'une option marche.
 */
export function vibrerRepetition(appareil?: Vibreur): boolean {
  if (!vibrationActive() || !vibrationDisponible(appareil)) return false;
  try {
    return appareil!.vibrate!(DUREE_VIBRATION_MS) !== false;
  } catch {
    // Certains navigateurs lèvent quand la page n'a pas encore été touchée.
    // Une vibration perdue ne doit pas casser le comptage.
    return false;
  }
}
