import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estJourValide } from "@/lib/serie";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // AAAA-MM-JJ
  /**
   * La forme ne suffit pas : « 9999-99-99 » la respecte et n'est pas une date.
   *
   * `new Date` rendait alors une date invalide, qui traversait jusqu'à Prisma
   * et faisait tomber la route avec une erreur 500 — sur une adresse qu'un
   * navigateur construit, donc atteignable par un simple clic mal placé dans
   * le calendrier. La règle a déménagé dans `estJourValide` le jour où une
   * seconde route en a eu besoin.
   */
  if (!estJourValide(date)) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  const games = await prisma.game.findMany({
    // Le détail horaire est une statistique : les parties sans enjeu en
    // sortent, comme du reste du tableau de bord.
    where: { userId: user.id, sansEnjeu: false, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  const byHour: Record<number, number> = {};
  for (const g of games) {
    const h = g.date.getUTCHours();
    byHour[h] = (byHour[h] || 0) + g.pompesCalculees;
  }

  const hourly = Array.from({ length: 24 }, (_, h) => ({
    // Le numéro : c'est le navigateur qui nomme l'heure dans la langue du
    // lecteur. `label` reste pour un onglet resté ouvert sur une réponse
    // plus ancienne.
    heure: h,
    label: `${h}h`,
    total: byHour[h] || 0,
  })).filter((_, h) => !!byHour[h]);

  return NextResponse.json({ hourly, total: games.reduce((s, g) => s + g.pompesCalculees, 0), games: games.length });
}
