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
  const pompesByNiveau: Record<number, number> = {};
  for (const g of games) {
    pompesByRole[g.role] = (pompesByRole[g.role] || 0) + g.pompesCalculees;
    pompesByNiveau[g.niveauCalcule] = (pompesByNiveau[g.niveauCalcule] || 0) + g.pompesCalculees;
  }

  // Cumul par date pour le graphique
  const cumulByDate: { date: string; cumul: number }[] = [];
  let cumul = 0;
  for (const g of games) {
    cumul += g.pompesCalculees;
    cumulByDate.push({ date: g.date.toString().slice(0, 10), cumul });
  }

  return NextResponse.json({
    totalGames,
    wins,
    winrate,
    totalPompes,
    recordPompes,
    pompesByRole,
    pompesByNiveau,
    cumulByDate,
    objectifTotalPompes: goal?.objectifTotalPompes ?? 1000,
    niveau: user?.gainageMaxSec ?? 45,
  });
}
