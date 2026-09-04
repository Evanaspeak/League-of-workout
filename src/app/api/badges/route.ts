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
      // Les parties sans enjeu sortent des paliers : elles ne coûtent rien,
      // donc elles ne valent rien à un compteur d'effort — mais leur NOMBRE
      // ferait quand même avancer les paliers qui comptent des parties.
      where: { userId: user.id, sansEnjeu: false },
      _sum: { pompesCalculees: true },
      _count: { _all: true },
    }),
    prisma.paiement.findMany({
      where: { userId: user.id },
      // `points` s'ajoute au MÊME select : le niveau se calcule sur l'effort
      // PAYÉ, et une colonne de plus sur une requête qu'on fait déjà ne coûte
      // rien, là où un agrégat séparé serait un aller-retour de plus vers Neon.
      select: { jour: true, points: true },
      orderBy: { jour: "desc" },
      take: 800,
    }),
  ]);

  return NextResponse.json(reponseBadges({
    totalPoints: agregat._sum.pompesCalculees ?? 0,
    parties: agregat._count._all ?? 0,
    jours: paiements.map((p) => p.jour),
    pointsPayes: paiements.reduce((somme, p) => somme + p.points, 0),
  }));
}
