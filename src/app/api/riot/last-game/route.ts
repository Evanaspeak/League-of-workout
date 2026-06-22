import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectRole } from "@/lib/riot-role";
import { getCurrentUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const REGION_ROUTING: Record<string, string> = {
  EUW1: "europe", EUN1: "europe", TR1: "europe", RU: "europe",
  NA1: "americas", BR1: "americas", LA1: "americas", LA2: "americas",
  KR: "asia", JP1: "asia",
  OC1: "sea", PH2: "sea", SG2: "sea", TH2: "sea", TW2: "sea", VN2: "sea",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch Riot avec retry sur 429 (rate limit) et 5xx, en respectant Retry-After.
async function riotFetch(url: string, apiKey: string, tries = 4): Promise<Response> {
  let res: Response = new Response(null, { status: 500 });
  for (let attempt = 0; attempt < tries; attempt++) {
    res = await fetch(url, { headers: { "X-Riot-Token": apiKey }, cache: "no-store" });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < tries - 1) {
        const retryAfter = Number(res.headers.get("Retry-After")) || (attempt + 1);
        await sleep(retryAfter * 1000);
        continue;
      }
    }
    return res;
  }
  return res;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!user.riotPuuid) {
    return NextResponse.json({ error: "PUUID manquant. Configure ton Riot ID dans Réglages." }, { status: 400 });
  }

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Riot manquante (RIOT_API_KEY dans .env)" }, { status: 500 });
  }

  const routing = REGION_ROUTING[user.riotRegion] ?? "europe";
  const puuid = user.riotPuuid;

  const idsRes = await riotFetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1`,
    apiKey
  );
  if (!idsRes.ok) {
    const err = await idsRes.json().catch(() => ({}));
    return NextResponse.json({ error: `Erreur Riot API: ${idsRes.status}`, details: err }, { status: idsRes.status });
  }

  const ids: string[] = await idsRes.json();
  if (!ids.length) {
    return NextResponse.json({ error: "Aucune game trouvée." }, { status: 404 });
  }

  // Mode "peek" : renvoie juste l'ID de la dernière game, sans la logger.
  // Sert à fixer un point de départ au démarrage d'une session.
  const peek = new URL(req.url).searchParams.get("peek");
  if (peek) {
    return NextResponse.json({ matchId: ids[0] });
  }

  const alreadyLogged = await prisma.game.findFirst({ where: { riotMatchId: ids[0], userId: user.id } });
  if (alreadyLogged) {
    return NextResponse.json({ error: "Cette game est déjà loggée." }, { status: 409 });
  }

  const matchRes = await riotFetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/${ids[0]}`,
    apiKey
  );
  if (!matchRes.ok) {
    return NextResponse.json({ error: `Erreur Riot API: ${matchRes.status}` }, { status: matchRes.status });
  }

  const match = await matchRes.json();
  const queueId: number = match.info.queueId;
  const participant = match.info.participants.find((p: { puuid: string }) => p.puuid === puuid);

  if (!participant) {
    return NextResponse.json({ error: "Participant non trouvé dans le match." }, { status: 404 });
  }

  const role = detectRole(match.info, participant);

  return NextResponse.json({
    matchId: ids[0],
    champion: participant.championName,
    role,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    result: participant.win ? "V" : "D",
    queueId,
  });
}
