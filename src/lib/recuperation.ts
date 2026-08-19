import { createHash } from "crypto";

/**
 * Récupération de compte : le jeton et sa forme stockée.
 *
 * La demande de récupération ne modifie rien — elle envoie un lien. C'est
 * l'ouverture du lien qui remplace le code. Avant, la demande écrasait le mot
 * de passe sur-le-champ : connaître l'adresse de quelqu'un suffisait à lui
 * faire tourner son identifiant sans qu'il ait rien demandé.
 */

/** Préfixe d'identifiant, pour ne pas se mêler aux jetons d'Auth.js. */
export const PREFIXE_RESET = "reset:";

/** Un lien vaut une heure : le temps de relever sa boîte, pas davantage. */
export const VALIDITE_MS = 60 * 60 * 1000;

/** On ne stocke jamais le jeton lui-même : son empreinte suffit à le vérifier. */
export function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}
