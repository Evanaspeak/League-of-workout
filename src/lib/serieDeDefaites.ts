/**
 * Repérer une série de défaites, et le dire une fois.
 *
 * Jouer en enchaînant les défaites est le moment où l'on joue le plus mal, et
 * celui où l'on s'arrête le moins. L'application n'a pas à décider à la place
 * de qui que ce soit — mais elle voit quelque chose que le joueur, lui, ne
 * regarde pas : la suite.
 *
 * « Suggère, sans insister » : un seul message, à un seul seuil, et rien
 * ensuite. Un rappel qui revient à chaque défaite devient un reproche, et un
 * reproche se ferme sans se lire.
 */

export type PartieLue = {
  date: Date;
  /** "V" ou "D" ; tout autre résultat n'est ni l'un ni l'autre. */
  result: string;
};

/** Trois défaites d'affilée : en deçà, c'est une soirée ordinaire. */
export const SEUIL_DEFAITES = 3;

/**
 * Au-delà de cet écart, deux parties n'appartiennent pas à la même séance.
 *
 * Sans cette borne, trois défaites étalées sur trois semaines
 * déclencheraient le message — et personne ne comprendrait de quoi on parle.
 */
export const ECART_MAX_MS = 3 * 3600_000;

/**
 * Longueur de la série de défaites en cours, dans la séance en cours.
 *
 * @param parties de la plus récente à la plus ancienne.
 */
export function defaitesDAffilee(parties: PartieLue[], maintenant: Date = new Date()): number {
  let compte = 0;
  let precedente = maintenant;
  for (const p of parties) {
    // Une partie trop éloignée de la précédente ferme la séance : ce qui suit
    // appartient à un autre soir.
    if (precedente.getTime() - p.date.getTime() > ECART_MAX_MS) break;
    if (p.result !== "D") break;
    compte += 1;
    precedente = p.date;
  }
  return compte;
}

/** Faut-il en parler ? */
export function suggererUnePause(
  parties: PartieLue[], maintenant: Date = new Date(),
): boolean {
  return defaitesDAffilee(parties, maintenant) >= SEUIL_DEFAITES;
}
