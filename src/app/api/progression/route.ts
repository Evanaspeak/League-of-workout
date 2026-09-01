import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jourLocal } from "@/lib/serie";
import { reponseBadges, reponseSerie } from "@/lib/progression";

/**
 * Les paliers et la série, en un seul aller-retour.
 *
 * `/api/badges` et `/api/serie` lisaient **la même requête** — les huit cents
 * derniers jours payés — chacune de son côté, à chaque chargement du tableau
 * de bord ET après chaque paiement, puisque les deux composants écoutent
 * `wow-dette-changee`. Quatre lectures identiques par soirée pour deux
 * réponses qui se déduisent l'une de l'autre.
 *
 * Les deux routes d'origine restent : leurs tests les couvrent, et une adresse
 * publiée ne se retire pas parce qu'on en a écrit une meilleure. Ce qui ne se
 * dédouble pas, c'est la mise en forme, sortie dans `src/lib/progression.ts`.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Le jour vient du navigateur : c'est le sien qui compte. Quelqu'un qui paie
  // à une heure du matin verrait sinon sa série comptée sur la veille ou le
  // lendemain, selon le fuseau du serveur.
  const demande = new URL(req.url).searchParams.get("jour");
  const aujourdhui = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) ? demande : jourLocal();

  const [agregat, paiements] = await Promise.all([
    prisma.game.aggregate({
      where: { userId: user.id },
      _sum: { pompesCalculees: true },
      _count: { _all: true },
    }),
    prisma.paiement.findMany({
      where: { userId: user.id },
      select: { jour: true },
      // Une série ne remonte jamais bien loin, et la meilleure se recalcule sur
      // ce qu'on lit : deux ans de paiements quotidiens tiennent largement.
      orderBy: { jour: "desc" },
      take: 800,
    }),
  ]);

  const source = {
    totalPoints: agregat._sum.pompesCalculees ?? 0,
    parties: agregat._count._all ?? 0,
    jours: paiements.map((p) => p.jour),
  };

  return NextResponse.json({
    badges: reponseBadges(source),
    serie: reponseSerie(source, aujourdhui, user),
  });
}
