import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { etatRetard, jourLocal, longueurSerie, meilleureSerie } from "@/lib/serie";

/**
 * La série de jours payés, et l'éventuel retard.
 *
 * Le jour d'aujourd'hui vient du navigateur : c'est le sien qui compte, pas
 * celui du serveur. Quelqu'un qui paie à une heure du matin verrait sinon sa
 * série comptée sur la veille ou le lendemain selon le fuseau.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const demande = new URL(req.url).searchParams.get("jour");
  const aujourdhui = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) ? demande : jourLocal();

  const paiements = await prisma.paiement.findMany({
    where: { userId: user.id },
    select: { jour: true },
    // Une série ne remonte jamais bien loin, et la meilleure se recalcule sur
    // ce qu'on lit : deux ans de paiements quotidiens tiennent largement.
    orderBy: { jour: "desc" },
    take: 800,
  });

  const jours = paiements.map((p) => p.jour);
  const retard = etatRetard(user.detteDepuis, user.dettePointsDus);

  return NextResponse.json({
    serie: longueurSerie(jours, aujourdhui),
    meilleure: meilleureSerie(jours),
    payeAujourdhui: jours.includes(aujourdhui),
    enRetard: retard.enRetard,
    joursDeRetard: retard.jours,
  });
}
