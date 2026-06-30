import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getLevel } from "@/lib/scoring";

const ADMIN_EMAIL = "evantocquet@gmail.com";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const levelConfigs = await prisma.levelConfig.findMany({ orderBy: { seuilGainageSec: "asc" } });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      pseudo: true,
      betaRank: true,
      riotId: true,
      riotRegion: true,
      gainageMaxSec: true,
      createdAt: true,
      games: {
        select: {
          date: true,
          pompesCalculees: true,
          result: true,
          role: true,
          niveauCalcule: true,
        },
        orderBy: { date: "desc" },
      },
    },
    orderBy: { betaRank: "asc" },
  });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const result = users.map((u) => {
    const games = u.games;
    const totalGames = games.length;
    const totalPompes = games.reduce((s, g) => s + g.pompesCalculees, 0);
    const lastGame = games[0]?.date ?? null;
    const gamesThisWeek = games.filter((g) => new Date(g.date) >= oneWeekAgo).length;
    const gamesThisMonth = games.filter((g) => new Date(g.date) >= oneMonthAgo).length;
    const winrate = totalGames > 0
      ? Math.round((games.filter((g) => g.result === "V").length / totalGames) * 100)
      : 0;
    const avgPompes = totalGames > 0 ? Math.round(totalPompes / totalGames) : 0;
    const lastLevel = games[0]?.niveauCalcule ?? null;

    const lvl = levelConfigs.length > 0 ? getLevel(u.gainageMaxSec, levelConfigs) : null;

    return {
      id: u.id,
      email: u.email,
      pseudo: u.pseudo,
      betaRank: u.betaRank,
      riotId: u.riotId,
      riotRegion: u.riotRegion,
      gainageMaxSec: u.gainageMaxSec,
      createdAt: u.createdAt,
      totalGames,
      totalPompes,
      avgPompes,
      winrate,
      lastGame,
      gamesThisWeek,
      gamesThisMonth,
      lastLevel,
      niveauActuel: lvl?.niveau ?? null,
      multiplicateur: lvl?.multiplicateur ?? null,
      malusDefaite: lvl?.malusDefaite ?? null,
    };
  });

  return NextResponse.json({ users: result });
}
