import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

const QUEUE_MODE: Record<number, string> = {
  450: "ARAM",
  1700: "Arena", 1710: "Arena",
};

const riotFetch = (url: string, apiKey: string) =>
  fetch(url, { headers: { "X-Riot-Token": apiKey }, cache: "no-store" });

export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user?.riotPuuid) {
    return NextResponse.json({ error: "PUUID manquant. Configure ton Riot ID dans Profil." }, { status: 400 });
  }

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Riot manquante (RIOT_API_KEY dans .env)" }, { status: 500 });
  }

  const routing = REGION_ROUTING[user.riotRegion] ?? "europe";
  const puuid = user.riotPuuid;

  const idsRes = await riotFetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`,
    apiKey
  );
  if (!idsRes.ok) {
    const err = await idsRes.json().catch(() => ({}));
    return NextResponse.json({ error: `Erreur Riot API: ${idsRes.status}`, details: err }, { status: idsRes.status });
  }

  const ids: string[] = await idsRes.json();
  if (!ids.length) return NextResponse.json([]);

  const logged = await prisma.game.findMany({
    where: { riotMatchId: { in: ids } },
    select: { riotMatchId: true, pompesCalculees: true },
  });
  const loggedMap = new Map(logged.map((g) => [g.riotMatchId, g.pompesCalculees]));

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const BATCH = 4;
  const results: (object | null)[] = [];

  for (let i = 0; i < ids.length; i += BATCH) {
    if (i > 0) await sleep(400);
    const batch = ids.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await riotFetch(
            `https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`,
            apiKey
          );
          if (!res.ok) {
            console.error(`[match-history] ${id} → HTTP ${res.status}`);
            return null;
          }

          const match = await res.json();
          if (!match?.info?.participants) return null;

          const queueId: number = match.info.queueId ?? 0;
          const gameMode: string = match.info.gameMode ?? "";
          const participant = match.info.participants.find((p: { puuid: string }) => p.puuid === puuid);
          if (!participant) {
            console.error(`[match-history] ${id} → participant non trouvé (queueId=${queueId})`);
            return null;
          }

          let role: string;
          if (gameMode === "CHERRY") {
            role = "Arena";
          } else if (gameMode === "ARAM" || queueId === 450) {
            role = "ARAM";
          } else if (QUEUE_MODE[queueId]) {
            role = QUEUE_MODE[queueId];
          } else {
            const pos = participant.teamPosition || participant.individualPosition || "";
            role = LANE_MAP[pos] ?? "Mid";
          }

          const alreadyLogged = loggedMap.has(id);
          const ts = match.info.gameEndTimestamp ?? match.info.gameCreation ?? Date.now();

          return {
            matchId: id,
            champion: (participant.championName as string) ?? "?",
            role,
            kills: (participant.kills as number) ?? 0,
            deaths: (participant.deaths as number) ?? 0,
            assists: (participant.assists as number) ?? 0,
            result: participant.win ? "V" : "D",
            date: new Date(ts).toISOString(),
            alreadyLogged,
            pompesCalculees: alreadyLogged ? loggedMap.get(id) : null,
          };
        } catch (e) {
          console.error(`[match-history] ${id} → exception:`, e);
          return null;
        }
      })
    );
    results.push(...batchResults);
  }

  return NextResponse.json(results.filter(Boolean));
}
