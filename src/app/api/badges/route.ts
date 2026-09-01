import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { reponseBadges } from "@/lib/progression";

/**
 * Les paliers atteints, et le prochain.
 *
 * Tout se déduit de ce qui est déjà en base. Rien n'est stocké : un badge rangé
 * dans une table finit par diverger de ce qu'il prétend décrire, le jour où une
 * partie est supprimée.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [agregat, paiements] = await Promise.all([
    prisma.game.aggregate({
      where: { userId: user.id },
      _sum: { pompesCalculees: true },
      _count: { _all: true },
    }),
    prisma.paiement.findMany({
      where: { userId: user.id },
      select: { jour: true },
      orderBy: { jour: "desc" },
      take: 800,
    }),
  ]);

  return NextResponse.json(reponseBadges({
    totalPoints: agregat._sum.pompesCalculees ?? 0,
    parties: agregat._count._all ?? 0,
    jours: paiements.map((p) => p.jour),
  }));
}
