/**
 * L'heure qu'il est chez quelqu'un.
 *
 * Le serveur ne connaît que l'heure UTC. Tout ce qui s'envoie « le matin »
 * doit donc passer par ici, sans quoi un rappel prévu pour neuf heures tombe
 * à trois heures du matin pour une partie des comptes — c'est-à-dire l'inverse
 * exact d'un service rendu.
 */

/**
 * Le fuseau est-il un identifiant que le système sait interpréter ?
 *
 * On le demande à `Intl` plutôt que de tenir une liste : la base IANA change
 * plusieurs fois par an, et une liste écrite à la main aurait refusé des
 * fuseaux réels quelques mois après avoir été écrite.
 */
export function estFuseauValide(valeur: unknown): valeur is string {
  if (typeof valeur !== "string" || valeur.length === 0 || valeur.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: valeur });
    return true;
  } catch {
    return false;
  }
}

/**
 * L'heure locale (0–23) dans un fuseau, à un instant donné.
 *
 * Rend `null` si le fuseau est inconnu : un fuseau qu'on ne sait pas lire ne
 * doit pas se transformer en heure UTC déguisée en heure locale. « On ne sait
 * pas » et « il est neuf heures » sont deux réponses différentes, et les
 * confondre envoie la notification au mauvais moment.
 */
export function heureLocale(instant: Date, fuseau: unknown): number | null {
  if (!estFuseauValide(fuseau)) return null;
  const heure = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau, hour: "numeric", hour12: false,
  }).format(instant);
  const n = Number(heure);
  // `hour12: false` rend « 24 » à minuit sur certaines plateformes.
  if (!Number.isFinite(n)) return null;
  return n % 24;
}
