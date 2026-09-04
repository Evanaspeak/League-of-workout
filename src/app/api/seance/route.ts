import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estGrosseSeance, FENETRE_JOURS } from "@/lib/grosseSeance";
import { jourLocal } from "@/lib/serie";

/**
 * La dernière séance payée, et si elle mérite d'être montrée.
 *
 * Séparée de l'image comme `/api/bilan` l'est de `/api/bilan/image` : l'écran
 * a besoin de SAVOIR s'il propose quelque chose, bien avant de dessiner quoi
 * que ce soit. Charger une image de 1200 pixels pour découvrir qu'il n'y avait
 * rien à proposer serait le mauvais sens.
 *
 * Le chiffre vient de la BASE et non du navigateur : sinon n'importe qui
 * fabrique une image à douze mille points, et ce qu'on partagerait alors ne
 * dirait plus rien de personne.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const paiements = await prisma.paiement.findMany({
    where: { userId: user.id },
    select: { id: true, points: true, jour: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  const derniere = paiements[0] ?? null;
  if (!derniere) return NextResponse.json({ partageable: false, points: 0 });

  /**
   * La fenêtre se borne sur le JOUR local du paiement, pas sur `createdAt`.
   *
   * C'est ce jour-là qui fait foi partout ailleurs — la série, le retard — et
   * une séance faite à une heure du matin appartient à la soirée de la veille.
   */
  const debut = new Date(Date.now() - FENETRE_JOURS * 86_400_000);
  const jourDebut = jourLocal(debut);
  const precedents = paiements
    .filter((p) => p.id !== derniere.id && p.jour >= jourDebut)
    .map((p) => p.points);

  return NextResponse.json({
    partageable: estGrosseSeance(derniere.points, precedents),
    points: derniere.points,
    fenetre: FENETRE_JOURS,
  });
}
