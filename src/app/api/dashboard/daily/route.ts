import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // AAAA-MM-JJ
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  /**
   * La forme ne suffit pas : « 9999-99-99 » la respecte et n'est pas une date.
   *
   * `new Date` rendait alors une date invalide, qui traversait jusqu'à Prisma
   * et faisait tomber la route avec une erreur 500 — sur une adresse qu'un
   * navigateur construit, donc atteignable par un simple clic mal placé dans
   * le calendrier.
   */
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  /**
   * Le contrôle porte sur l'aller-retour, pas seulement sur « est-ce un
   * nombre ».
   *
   * « 9999-99-99 » donne une date invalide, qui traversait jusqu'à la base et
   * faisait tomber la route ; « 2026-02-30 » n'est pas rejeté du tout par
   * `Date` selon la plateforme — il glisse au 2 mars, et la journée montrée
   * n'est alors pas celle demandée. Réécrire la date et la comparer attrape
   * les deux, et `toISOString` lève sur une date invalide : on regarde d'abord
   * qu'elle en est une.
   */
  const valide = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
    && start.toISOString().slice(0, 10) === date;
  if (!valide) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

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
