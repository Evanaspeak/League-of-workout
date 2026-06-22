import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const REGION_ROUTING: Record<string, string> = {
  EUW1: "europe", EUN1: "europe", TR1: "europe", RU: "europe",
  NA1: "americas", BR1: "americas", LA1: "americas", LA2: "americas",
  KR: "asia", JP1: "asia",
  OC1: "sea", PH2: "sea", SG2: "sea", TH2: "sea", TW2: "sea", VN2: "sea",
};

export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user?.riotPuuid) return NextResponse.json({ error: "no puuid" });

  const apiKey = process.env.RIOT_API_KEY!;
  const routing = REGION_ROUTING[user.riotRegion] ?? "europe";
  const puuid = user.riotPuuid;

  const idsRes = await fetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`,
    { headers: { "X-Riot-Token": apiKey }, cache: "no-store" }
  );

  if (!idsRes.ok) return NextResponse.json({ error: `ids fetch ${idsRes.status}` });

  const ids: string[] = await idsRes.json();
  const report: object[] = [];

  for (const id of ids) {
    const res = await fetch(
      `https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`,
      { headers: { "X-Riot-Token": apiKey }, cache: "no-store" }
    );

    if (!res.ok) {
      report.push({ id, httpStatus: res.status, error: "fetch failed" });
      continue;
    }

    let match: Record<string, unknown>;
    try { match = await res.json(); } catch {
      report.push({ id, error: "json parse failed" });
      continue;
    }

    const info = match.info as Record<string, unknown> | undefined;
    const participants = info?.participants as { puuid: string }[] | undefined;
    const participant = participants?.find((p) => p.puuid === puuid);

    report.push({
      id,
      httpStatus: res.status,
      queueId: info?.queueId,
      gameMode: info?.gameMode,
      participantCount: participants?.length ?? 0,
      participantFound: !!participant,
      win: participant ? (participant as Record<string, unknown>).win : null,
      championName: participant ? (participant as Record<string, unknown>).championName : null,
    });
  }

  return NextResponse.json(report, { headers: { "Content-Type": "application/json" } });
}
