import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  const { riotId: rawRiotId, region } = await req.json();

  // Strip invisible Unicode directional/formatting chars injected by the League client (e.g. U+2066, U+2069)
  const riotId = Array.from(rawRiotId as string)
    .filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code >= 0x20 && !(code >= 0x200b && code <= 0x206f) && code !== 0xfeff;
    })
    .join("")
    .trim();

  const apiKey = process.env.RIOT_API_KEY?.trim();
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

  const res = await fetch(
    `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${apiKey}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Joueur introuvable (${res.status})` }, { status: res.status });
  }

  const data = await res.json();
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { riotPuuid: data.puuid, riotId, riotRegion: region },
    });
  }

  return NextResponse.json({ puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine });
}
