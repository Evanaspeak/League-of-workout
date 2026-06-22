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

// Données de match déjà traitées, gardées en mémoire pour éviter de
// re-frapper l'API Riot à chaque visite de la page (cause des 429).
type CachedMatch = {
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  date: string;
};
const matchCache = new Map<string, CachedMatch>();

// fetch Riot avec gestion du rate limit (429) et des erreurs serveur (5xx).
// On respecte le header Retry-After quand il est présent.
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

export async function GET() {
  const user = await prisma.user.findFirst();
  console.log("[match-history] user:", user ? { id: user.id, puuid: user.riotPuuid?.substring(0, 12), region: user.riotRegion } : "null");
  if (!user?.riotPuuid) {
    return NextResponse.json({ error: "PUUID manquant. Configure ton Riot ID dans Profil." }, { status: 400 });
  }

  const apiKey = process.env.RIOT_API_KEY;
  console.log("[match-history] apiKey present:", !!apiKey);
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Riot manquante (RIOT_API_KEY dans .env)" }, { status: 500 });
  }

  const routing = REGION_ROUTING[user.riotRegion] ?? "europe";
  const puuid = user.riotPuuid;
  console.log("[match-history] routing:", routing);

  const idsRes = await riotFetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`,
    apiKey
  );
  if (!idsRes.ok) {
    const err = await idsRes.json().catch(() => ({}));
    return NextResponse.json({ error: `Erreur Riot API: ${idsRes.status}`, details: err }, { status: idsRes.status });
  }

  const ids: string[] = await idsRes.json();
  console.log("[match-history] ids count:", ids.length, "first:", ids[0]);
  if (!ids.length) return NextResponse.json([]);

  const logged = await prisma.game.findMany({
    where: { riotMatchId: { in: ids } },
    select: { riotMatchId: true, pompesCalculees: true },
  });
  const loggedMap = new Map(logged.map((g) => [g.riotMatchId, g.pompesCalculees]));

  // On ne récupère sur Riot que les matchs absents du cache.
  const missing = ids.filter((id) => !matchCache.has(id));
  console.log("[match-history] cached:", ids.length - missing.length, "missing:", missing.length);
  const BATCH = 4;

  for (let i = 0; i < missing.length; i += BATCH) {
    if (i > 0) await sleep(300);
    const batch = missing.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await riotFetch(
            `https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`,
            apiKey
          );
          console.log(`[match-history] match ${id.slice(-8)}: HTTP ${res.status}`);
          if (!res.ok) return;

          const match = await res.json();
          if (!match?.info?.participants) return;

          const queueId: number = match.info.queueId ?? 0;
          const gameMode: string = match.info.gameMode ?? "";
          const mapId: number = match.info.mapId ?? 0;
          const participant = match.info.participants.find((p: { puuid: string }) => p.puuid === puuid);
          if (!participant) return;

          let role: string;
          if (gameMode === "CHERRY" || ARENA_QUEUES.has(queueId)) {
            // CHERRY sur la Faille hurlante (mapId 12) = "ARAM du chaos", sinon Arena
            role = mapId === 12 ? "ARAM" : "Arena";
          } else if (gameMode === "ARAM" || ARAM_QUEUES.has(queueId)) {
            role = "ARAM";
          } else {
            const pos = participant.teamPosition || participant.individualPosition || "";
            role = LANE_MAP[pos] ?? "Mid";
          }

          const ts = match.info.gameEndTimestamp ?? match.info.gameCreation ?? Date.now();
          matchCache.set(id, {
            champion: (participant.championName as string) ?? "?",
            role,
            kills: (participant.kills as number) ?? 0,
            deaths: (participant.deaths as number) ?? 0,
            assists: (participant.assists as number) ?? 0,
            result: participant.win ? "V" : "D",
            date: new Date(ts).toISOString(),
          });
        } catch {
          // ignoré : le match restera marqué indisponible ci-dessous
        }
      })
    );
  }

  // On renvoie les matchs dans l'ordre Riot ; un match non récupéré
  // (erreur persistante) est marqué pour rester visible.
  const results = ids.map((id) => {
    const c = matchCache.get(id);
    const alreadyLogged = loggedMap.has(id);
    if (!c) {
      return { matchId: id, champion: "?", role: "?", kills: 0, deaths: 0, assists: 0,
        result: "?", date: new Date().toISOString(), alreadyLogged, pompesCalculees: null, indisponible: true };
    }
    return {
      matchId: id,
      champion: c.champion,
      role: c.role,
      kills: c.kills,
      deaths: c.deaths,
      assists: c.assists,
      result: c.result,
      date: c.date,
      alreadyLogged,
      pompesCalculees: alreadyLogged ? loggedMap.get(id) : null,
      indisponible: false,
    };
  });

  const available = results.filter((r) => !r.indisponible).length;
  console.log("[match-history] returning:", results.length, "total,", available, "available,", results.length - available, "indisponible");
  return NextResponse.json(results);
}
