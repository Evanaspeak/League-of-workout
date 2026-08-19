/**
 * Marge accordée au futur.
 *
 * La date arrive d'un champ `datetime-local`, donc de l'horloge du poste, et
 * elle est jugée par celle du serveur. Refuser à la seconde près ferait
 * échouer une saisie honnête faite sur une machine en légère avance. Cinq
 * minutes couvrent largement l'écart sans laisser passer « demain ».
 */
const MARGE_FUTUR_MS = 5 * 60 * 1000;

export type DateAnalysee =
  | { ok: true; date: Date }
  | { ok: false; erreur: string };

/**
 * Valide la date d'une partie.
 *
 * Une partie se joue avant d'être enregistrée : une date dans le futur ne
 * décrit rien de réel. Elle décalait pourtant les statistiques par période, la
 * progression cumulative et le calendrier, sans qu'aucun écran ne signale
 * d'où venait l'anomalie — la saisie était acceptée telle quelle.
 *
 * Le passé reste libre : rattraper une soirée oubliée est un usage normal.
 */
export function analyserDatePartie(valeur: unknown): DateAnalysee {
  if (typeof valeur !== "string" && typeof valeur !== "number") {
    return { ok: false, erreur: "Date invalide" };
  }
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, erreur: "Date invalide" };
  }
  if (date.getTime() > Date.now() + MARGE_FUTUR_MS) {
    return { ok: false, erreur: "Une partie ne peut pas être datée dans le futur" };
  }
  return { ok: true, date };
}
