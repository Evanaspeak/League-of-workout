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
 * valeur à la source, et l'en-tête de cache fait que cette lecture ne coûte
 * rien d'une page à l'autre.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const ratios = await chargerRatios();
  return NextResponse.json({ ratios }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
