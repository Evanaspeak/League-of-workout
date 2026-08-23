/**
 * Le compteur de dette dans le titre de l'onglet.
 *
 * C'est le rappel le moins coûteux qui existe : il ne notifie rien, ne
 * réclame aucune permission, et se voit dans la barre d'onglets même quand la
 * page est en arrière-plan — c'est-à-dire précisément quand on est en train
 * de jouer.
 */

/**
 * Préfixe reconnaissable, pour pouvoir le retirer.
 *
 * Sans motif de retrait, chaque changement de page ajouterait un préfixe au
 * précédent : « (38) (38) (12) Win or Workout ». Le titre est réécrit par le
 * routeur à chaque navigation, et on ne peut donc pas se contenter de garder
 * l'ancien en mémoire.
 */
const MOTIF = /^\((?:[^)]*)\)\s+/;

/** Le titre sans son compteur, quel qu'il soit. */
export function titreNu(titre: string): string {
  return titre.replace(MOTIF, "");
}

/**
 * Le titre à poser.
 *
 * Une valeur vide ou nulle rend le titre nu : quand il n'y a plus rien à
 * faire, l'onglet doit cesser de le rappeler.
 */
export function titreAvecDette(titre: string, dette: string | null | undefined): string {
  const nu = titreNu(titre);
  const valeur = (dette ?? "").trim();
  if (valeur === "") return nu;
  return `(${valeur}) ${nu}`;
}
