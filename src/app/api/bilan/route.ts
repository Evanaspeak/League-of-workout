import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { chargerRatios } from "@/lib/exercicesConfig";
import { jourDansFuseau } from "@/lib/fuseau";
import { calculerBilan, JOURS_SAISON } from "@/lib/bilanSaison";
import { repartirPoints, toExerciceIds } from "@/lib/exercices";

/**
 * Le bilan des quatre-vingt-dix derniers jours.
 *
 * L'application ne sait dire que le présent — ce qu'on doit, là, maintenant.
 * Trois mois mis bout à bout disent autre chose, et c'est la seule chose qu'on
 * ait envie de montrer à quelqu'un.
 *
 * Elle ne rend que des chiffres du compte courant. Il n'y a pas de version
 * publique de cette route : rendre les statistiques de quelqu'un lisibles par
 * une adresse est une décision qui se prend, pas un effet de bord.
 */
export async function GET() {
  // La répartition s'exprime avec les ratios réglés en administration.
  await chargerRatios();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const maintenant = new Date();
  const depuis = new Date(maintenant.getTime() - JOURS_SAISON * 24 * 60 * 60 * 1000);
  const jourDe = (d: Date) => jourDansFuseau(d, user.fuseau);

  const [parties, paiements] = await Promise.all([
    prisma.game.findMany({
      // Le bilan de saison est un résumé de ce qui a compté.
      where: { userId: user.id, sansEnjeu: false, date: { gte: depuis } },
      select: { date: true, result: true, pompesCalculees: true, jeu: true, champion: true },
    }),
    prisma.paiement.findMany({
      where: { userId: user.id, jour: { gte: jourDe(depuis) } },
      select: { points: true, jour: true },
    }),
  ]);

  const bilan = calculerBilan(parties, paiements, jourDe(depuis), jourDe(maintenant), jourDe);

  return NextResponse.json({
    ...bilan,
    pseudo: user.pseudo,
    /**
     * L'effort payé, exprimé dans les exercices du compte.
     *
     * Le bilan vit en points, comme le reste ; mais « 4 200 points » ne dit
     * rien à personne, et c'est une image qu'on va montrer. La conversion se
     * fait ici parce que les ratios sont chargés ici.
     */
    repartitionPayee: repartirPoints(bilan.pointsPayes, toExerciceIds(user.exercices)),
  });
}
