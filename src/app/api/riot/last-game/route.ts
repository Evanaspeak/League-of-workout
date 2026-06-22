import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REGION_ROUTING: Record<string, string> = {
  EUW1: "europe", EUN1: "europe", TR1: "europe", RU: "europe",
  NA1: "americas", BR1: "americas", LA1: "americas", LA2: "americas",
  KR: "asia", JP1: "asia",
  OC1: "sea", PH2: "sea", SG2: "sea", TH2: "sea", TW2: "sea", VN2: "sea",
};

const LANE_MAP: Record<string, string> = {
  TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid",
  BOTTOM: "ADC", UTILITY: "Support",
};

// Queues qui ne sont pas sur la Summoner's Rift classique
const QUEUE_MODE: Record<number, string> = {
  450: "ARAM",
  1700: "Arena",
  1710: "Arena",
  1712: "Arena",
  1720: "Arena",
  1730: "Arena",
};

export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user?.riotPuuid) {
    return NextResponse.json({ error: "PUUID manquant. Configure ton Riot ID dans Profil." }, { status: 400 });
  }

  const apiKey = process.env.RIOT_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Riot manquante (RIOT_API_KEY dans .env)" }, { status: 500 });
  }

  const routing = REGION_ROUTING[user.riotRegion] ?? "europe";
  const puuid = user.riotPuuid;

  const idsRes = await fetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1&api_key=${apiKey}`
  );
  if (!idsRes.ok) {
    const err = await idsRes.json().catch(() => ({}));
    return NextResponse.json({ error: `Erreur Riot API: ${idsRes.status}`, details: err }, { status: idsRes.status });
  }

  const ids: string[] = await idsRes.json();
  if (!ids.length) {
    return NextResponse.json({ error: "Aucune game trouvée." }, { status: 404 });
  }

  const alreadyLogged = await prisma.game.findFirst({ where: { riotMatchId: ids[0] } });
  if (alreadyLogged) {
    return NextResponse.json({ error: "Cette game est déjà loggée." }, { status: 409 });
  }

  const matchRes = await fetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/${ids[0]}?api_key=${apiKey}`
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

  // Détection du rôle : priorité au mode de queue, puis teamPosition, puis fallback Arena si vide
  let role: string;
  if (QUEUE_MODE[queueId]) {
    role = QUEUE_MODE[queueId];
  } else {
    const pos = participant.teamPosition || participant.individualPosition || "";
    // teamPosition vide = mode non-SR (nouveau mode Arena, etc.)
    role = LANE_MAP[pos] ?? (pos ? "Mid" : "Arena");
  }

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
