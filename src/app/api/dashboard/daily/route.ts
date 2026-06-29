import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  const games = await prisma.game.findMany({
    where: { userId: user.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  const byHour: Record<number, number> = {};
  for (const g of games) {
    const h = g.date.getUTCHours();
    byHour[h] = (byHour[h] || 0) + g.pompesCalculees;
  }

  const hourly = Array.from({ length: 24 }, (_, h) => ({
    label: `${h}h`,
    total: byHour[h] || 0,
  })).filter((_, h) => !!byHour[h]);

  return NextResponse.json({ hourly, total: games.reduce((s, g) => s + g.pompesCalculees, 0), games: games.length });
}
