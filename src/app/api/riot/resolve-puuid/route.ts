import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { riotId, region } = await req.json();

  const apiKey = process.env.RIOT_API_KEY?.trim();
  console.log("[debug] RIOT_API_KEY length:", apiKey?.length);
  console.log("[debug] RIOT_API_KEY prefix:", apiKey?.slice(0, 10));
  console.log("[debug] riotId recu:", riotId, "region:", region);

  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Riot manquante" }, { status: 500 });
  }

  const [gameName, tagLine] = riotId.split("#");
  if (!gameName || !tagLine) {
    return NextResponse.json({ error: "Format invalide. Utilise pseudo#tag" }, { status: 400 });
  }

  const REGION_ROUTING: Record<string, string> = {
    EUW1: "europe", EUN1: "europe", TR1: "europe", RU: "europe",
    NA1: "americas", BR1: "americas", LA1: "americas", LA2: "americas",
    KR: "asia", JP1: "asia",
    OC1: "sea", PH2: "sea", SG2: "sea", TH2: "sea", TW2: "sea", VN2: "sea",
  };

  const routing = REGION_ROUTING[region] ?? "europe";
  const url = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${apiKey}`;
  console.log("[debug] URL appelee:", url.replace(apiKey, apiKey.slice(0,10) + "..."));

  const res = await fetch(url);
  console.log("[debug] Riot API status:", res.status);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log("[debug] Riot API error body:", body);
    return NextResponse.json({ error: `Joueur introuvable (${res.status})` }, { status: res.status });
  }

  const data = await res.json();
  const user = await prisma.user.findFirst();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { riotPuuid: data.puuid, riotId, riotRegion: region },
    });
  }

  return NextResponse.json({ puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine });
}
