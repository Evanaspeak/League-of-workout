import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [games, goal] = await Promise.all([
    prisma.game.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
  ]);

  const totalGames = games.length;
  const wins = games.filter((g) => g.result === "V").length;
  const winrate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const totalPompes = games.reduce((s, g) => s + g.pompesCalculees, 0);
  const recordPompes = games.length > 0 ? Math.max(...games.map((g) => g.pompesCalculees)) : 0;

  const pompesByRole: Record<string, number> = {};
  const gamesByRole: Record<string, number> = {};
  const pompesByNiveau: Record<number, number> = {};
  const champAgg: Record<string, { games: number; kills: number; deaths: number; assists: number; pompes: number }> = {};

  for (const g of games) {
    pompesByRole[g.role] = (pompesByRole[g.role] || 0) + g.pompesCalculees;
    gamesByRole[g.role] = (gamesByRole[g.role] || 0) + 1;
    pompesByNiveau[g.niveauCalcule] = (pompesByNiveau[g.niveauCalcule] || 0) + g.pompesCalculees;

    const champ = g.champion ?? "Inconnu";
    if (!champAgg[champ]) champAgg[champ] = { games: 0, kills: 0, deaths: 0, assists: 0, pompes: 0 };
    champAgg[champ].games++;
    champAgg[champ].kills += g.kills;
    champAgg[champ].deaths += g.deaths;
    champAgg[champ].assists += g.assists;
    champAgg[champ].pompes += g.pompesCalculees;
  }

  const champList = Object.entries(champAgg).map(([name, s]) => ({
    name,
    games: s.games,
    avgKills: +(s.kills / s.games).toFixed(1),
    avgDeaths: +(s.deaths / s.games).toFixed(1),
    avgAssists: +(s.assists / s.games).toFixed(1),
    kda: s.deaths === 0 ? null : +((s.kills + s.assists) / s.deaths).toFixed(2),
    avgPompes: Math.round(s.pompes / s.games),
  }));

  const mostPlayed = champList.length > 0
    ? champList.reduce((a, b) => b.games > a.games ? b : a)
    : null;

  const leastEfficient = champList.length > 0
    ? champList.reduce((a, b) => b.avgPompes > a.avgPompes ? b : a)
    : null;

  // Cumul par date pour le graphique
  const cumulByDate: { date: string; cumul: number }[] = [];
  let cumul = 0;
  for (const g of games) {
    cumul += g.pompesCalculees;
    cumulByDate.push({ date: g.date.toISOString().slice(0, 10), cumul });
  }

  // Moyennes par période (heure / jour de semaine / mois)
  const byHour: Record<number, { total: number; count: number }> = {};
  const byWeekday: Record<number, { total: number; count: number }> = {};
  const byMonth: Record<number, { total: number; count: number }> = {};

  for (const g of games) {
    const d = new Date(g.date);
    const h = d.getHours();
    const wd = d.getDay();
    const mo = d.getMonth();
    byHour[h] = byHour[h] ?? { total: 0, count: 0 };
    byHour[h].total += g.pompesCalculees;
    byHour[h].count++;
    byWeekday[wd] = byWeekday[wd] ?? { total: 0, count: 0 };
    byWeekday[wd].total += g.pompesCalculees;
    byWeekday[wd].count++;
    byMonth[mo] = byMonth[mo] ?? { total: 0, count: 0 };
    byMonth[mo].total += g.pompesCalculees;
    byMonth[mo].count++;
  }

  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

  const statsByPeriod = {
    hour: Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`,
      avg: byHour[h] ? Math.round(byHour[h].total / byHour[h].count) : 0,
      total: byHour[h]?.total ?? 0,
    })).filter((_, h) => !!byHour[h]),
    weekday: weekdayOrder.map((wd, i) => ({
      label: weekdayLabels[i],
      avg: byWeekday[wd] ? Math.round(byWeekday[wd].total / byWeekday[wd].count) : 0,
      total: byWeekday[wd]?.total ?? 0,
    })),
    month: monthLabels.map((label, i) => ({
      label,
      avg: byMonth[i] ? Math.round(byMonth[i].total / byMonth[i].count) : 0,
      total: byMonth[i]?.total ?? 0,
    })).filter((_, i) => !!byMonth[i]),
  };

  const byDayTotal: Record<string, number> = {};
  for (const g of games) {
    const day = g.date.toISOString().slice(0, 10);
    byDayTotal[day] = (byDayTotal[day] || 0) + g.pompesCalculees;
  }
  const dailyPompes = Object.entries(byDayTotal)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  return NextResponse.json({
    totalGames,
    wins,
    winrate,
    totalPompes,
    recordPompes,
    pompesByRole,
    gamesByRole,
    pompesByNiveau,
    cumulByDate,
    statsByPeriod,
    dailyPompes,
    mostPlayed,
    leastEfficient,
    objectifTotalPompes: goal?.objectifTotalPompes ?? 1000,
    niveau: user?.gainageMaxSec ?? 45,
  });
}
