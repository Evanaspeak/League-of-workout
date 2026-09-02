import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estJourValide, jourLocal } from "@/lib/serie";
import { reponseSerie } from "@/lib/progression";

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
  // La forme ne dit pas que le jour existe : « 2026-02-30 » passe le motif et
  // GLISSE au 2 mars selon la plateforme. La série se compterait alors depuis
  // un jour qui n'existe pas, en court-circuitant le repli prévu pour ça.
  const aujourdhui = estJourValide(demande) ? (demande as string) : jourLocal();

  const paiements = await prisma.paiement.findMany({
    where: { userId: user.id },
    select: { jour: true },
    // Une série ne remonte jamais bien loin, et la meilleure se recalcule sur
    // ce qu'on lit : deux ans de paiements quotidiens tiennent largement.
    orderBy: { jour: "desc" },
    take: 800,
  });

  return NextResponse.json(reponseSerie(
    { totalPoints: 0, parties: 0, jours: paiements.map((p) => p.jour) },
    aujourdhui,
    user,
  ));
}
