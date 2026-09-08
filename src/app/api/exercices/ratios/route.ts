import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { chargerRatios, ratiosPourCompte } from "@/lib/exercicesConfig";

/**
 * Ratios d'exercices en vigueur.
 *
 * Route publique : ces trois nombres voyagent déjà dans le HTML de chaque
 * page, il n'y a rien à protéger. Exiger une session la rendrait au contraire
 * inutilisable depuis la page d'accueil.
 *
 * Elle existe parce que la valeur portée par le HTML peut dater : les pages
 * sans données propres au compte sont mises en cache, et un changement fait
 * en administration ne les rejoint pas toujours. Le navigateur relit donc la
 * valeur à la source.
 *
 * **Et elle ne se met surtout pas en cache.** Elle a porté
 * `public, max-age=60, stale-while-revalidate=300`, ce qui défaisait
 * exactement ce pour quoi elle existe : le navigateur servait l'ancienne
 * valeur pendant une minute, puis jusqu'à cinq de plus en arrière-plan, et
 * `public` autorisait en prime le CDN à la garder pour tout le monde. La
 * réponse du navigateur ÉCRASE alors celle que le serveur venait de rendre
 * dans le HTML, qui était la bonne.
 *
 * Ce que ça donnait à l'écran : la pastille de dette convertissait les points
 * avec l'ancien ratio, le décompte affichait la durée calculée au serveur avec
 * le nouveau, et les deux nombres se contredisaient sur le même écran —
 * « 6 min 05 » sur la pastille, « 2 min 41 » dans le chrono. Le rapport entre
 * les deux valait exactement celui des deux ratios.
 *
 * Une requête de plus par page coûte moins qu'un chiffre faux : c'est le seul
 * arbitrage ici, et il ne se discute pas dans ce sens-là.
 *
 * **Elle rend le barème du COMPTE quand il y en a un** (réponse 047). C'est
 * elle qui porte les ratios personnels jusqu'au navigateur, et ce n'est pas un
 * détournement : le mécanisme existe précisément pour que la valeur portée par
 * le HTML puisse être corrigée à la source.
 *
 * La MISE EN PAGE, elle, continue de rendre le barème global, et il faut que
 * ça reste ainsi : elle est la racine de toutes les pages, y compris des cent
 * cinquante qui sont prérendues. Y lire la session les rendrait dynamiques
 * d'un coup — c'est le défaut qui avait mis toutes les pages publiques du
 * produit hors du magasin de prérendu, et il ne se refera pas pour trois
 * nombres.
 *
 * Ce que ça coûte : sur un écran connecté, la première peinture convertit avec
 * le barème commun, puis se corrige. C'est la fenêtre qui existe DÉJÀ pour un
 * changement d'administration ; elle ne s'ouvre pas plus grand ici.
 *
 * Et une lecture de session de plus par page, mais seulement quand il y en a
 * une : sans cookie, `getCurrentUser` rend `null` sans toucher la base, donc
 * une page publique ne paie rien.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const ratios = user
    ? await ratiosPourCompte(user.ratiosExercices)
    : await chargerRatios();
  return NextResponse.json({ ratios }, {
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}
