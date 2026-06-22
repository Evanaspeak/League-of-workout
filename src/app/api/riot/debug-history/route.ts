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

const ARAM_QUEUES = new Set([450]);
const ARENA_QUEUES = new Set([1700, 1710, 1712, 1720, 1730, 1750]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Endpoint de diagnostic : récupère les 20 derniers matchs un par un
// (séquentiel, pour ne pas fausser la lecture des 429) et renvoie le
// détail brut utile pour comprendre pourquoi une partie n'apparaît pas.
export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user?.riotPuuid) return NextResponse.json({ error: "PUUID manquant." }, { status: 400 });
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RIOT_API_KEY manquante." }, { status: 500 });

  const routing = REGION_ROUTING[user.riotRegion] ?? "europe";
  const puuid = user.riotPuuid;
  const headers = { "X-Riot-Token": apiKey };

  const idsRes = await fetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`,
    { headers, cache: "no-store" }
  );
  if (!idsRes.ok) {
    return NextResponse.json({ error: `ids: ${idsRes.status}`, retryAfter: idsRes.headers.get("Retry-After") }, { status: idsRes.status });
  }
  const ids: string[] = await idsRes.json();

  // Échantillon brut complet (tous les champs scalaires de info + participant)
  // pour la première partie de chaque combinaison gameMode/queueId rencontrée.
  const samples: Record<string, unknown> = {};
  const scalarsOnly = (obj: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || ["string", "number", "boolean"].includes(typeof v)) out[k] = v;
    }
    return out;
  };

  const rows = [];
  for (const id of ids) {
    await sleep(150);
    const res = await fetch(
      `https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) {
      rows.push({ id, httpStatus: res.status, retryAfter: res.headers.get("Retry-After") });
      continue;
    }
    const match = await res.json();
    const info = match?.info ?? {};
    const queueId: number = info.queueId ?? 0;
    const gameMode: string = info.gameMode ?? "";
    const mapId: number = info.mapId ?? 0;
    const participant = (info.participants ?? []).find((p: { puuid: string }) => p.puuid === puuid);

    let role = "?";
    if (participant) {
      if (gameMode === "CHERRY" || ARENA_QUEUES.has(queueId)) role = mapId === 12 ? "ARAM" : "Arena";
      else if (gameMode === "ARAM" || ARAM_QUEUES.has(queueId)) role = "ARAM";
      else role = LANE_MAP[participant.teamPosition || participant.individualPosition || ""] ?? "Mid";
    }

    const sampleKey = `${gameMode}/map${mapId}/q${queueId}`;
    if (!samples[sampleKey] && participant) {
      samples[sampleKey] = {
        info: scalarsOnly(info as Record<string, unknown>),
        participant: scalarsOnly(participant as Record<string, unknown>),
      };
    }

    rows.push({
      id,
      httpStatus: 200,
      queueId,
      gameMode,
      mapId,
      gameName: info.gameName ?? null,
      gameType: info.gameType ?? null,
      participantCount: (info.participants ?? []).length,
      participantFound: !!participant,
      roleCalcule: role,
      champion: participant?.championName ?? null,
      // champs qui peuvent distinguer Arena (augments/placement) de ARAM du chaos
      placement: participant?.placement ?? null,
      subteamPlacement: participant?.subteamPlacement ?? null,
      playerSubteamId: participant?.playerSubteamId ?? null,
      hasAugments: !!(participant?.playerAugment1 || participant?.playerAugment2),
    });
  }

  const summary = rows.reduce((acc: Record<string, number>, r) => {
    const k = r.httpStatus === 200 ? `${r.gameMode}/map${r.mapId}/q${r.queueId}=>${r.roleCalcule}` : `HTTP_${r.httpStatus}`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ total: ids.length, summary, samples, rows });
}
