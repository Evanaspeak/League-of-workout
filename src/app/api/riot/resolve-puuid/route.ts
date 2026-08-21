import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { REGIONS_RIOT, routageDe, validerRiotId } from "@/lib/riot-champs";

export async function POST(req: Request) {
  // La session se vérifie AVANT de parler à Riot. Elle ne l'était qu'après,
  // pour décider s'il fallait enregistrer le résultat : l'appel sortant, lui,
  // partait dans tous les cas avec la clé du serveur. Seul le middleware
  // séparait donc Internet d'un annuaire Riot gratuit tenu à nos frais.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Cette route interroge Riot sous la clé du serveur, partagée par tous les
  // comptes. Le verrou porte donc sur le compte : relier son Riot ID est un
  // geste rare, et vingt essais par quart d'heure couvrent largement une
  // erreur de région ou de pseudo.
  if (await isRateLimited(user.id, "riot-lookup")) {
    return NextResponse.json(
      { error: "Trop de recherches d'affilée. Réessaie dans quelques minutes." },
      { status: 429 },
    );
  }
  await recordAttempt(user.id, "riot-lookup");

  // Un corps qui n'est pas du JSON, ou dont `riotId` n'est pas une chaîne,
  // faisait remonter une exception non rattrapée et répondait 500.
  const body = await req.json().catch(() => null);
  const riotId = validerRiotId(body?.riotId);
  if (!riotId) {
    return NextResponse.json({ error: "Format invalide. Utilise pseudo#tag" }, { status: 400 });
  }

  const region = typeof body?.region === "string" && REGIONS_RIOT.includes(body.region)
    ? body.region
    : null;
  if (!region) {
    return NextResponse.json({ error: "Région inconnue" }, { status: 400 });
  }

  const apiKey = process.env.RIOT_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Riot manquante" }, { status: 500 });
  }

  const [gameName, tagLine] = riotId.split("#");
  const routing = routageDe(region);

  const res = await fetch(
    `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    { headers: { "X-Riot-Token": apiKey } },
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Joueur introuvable (${res.status})` }, { status: res.status });
  }

  const data = await res.json();
  await prisma.user.update({
    where: { id: user.id },
    data: { riotPuuid: data.puuid, riotId, riotRegion: region },
  });

  return NextResponse.json({ puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine });
}
