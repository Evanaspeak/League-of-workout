import { NextResponse } from "next/server";
import { chargerRatios } from "@/lib/exercicesConfig";

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
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const ratios = await chargerRatios();
  return NextResponse.json({ ratios }, {
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}
