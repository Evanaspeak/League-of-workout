import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { composerProfil, toPartage } from "@/lib/profilAmi";
import { etatRetard, longueurSerie, meilleureSerie, jourLocal } from "@/lib/serie";
import { debutFenetre } from "@/lib/classement";

/**
 * Le profil d'un ami, selon ce qu'il autorise.
 *
 * L'identifiant est celui de la PERSONNE, pas celui du lien : c'est ce que la
 * liste d'amis rend sous `id`, et les deux ne se confondent pas.
 *
 * Trois refus, dans cet ordre, et l'ordre compte : sans session on ne lit
 * rien ; sans amitié ACCEPTÉE on ne lit rien non plus — une demande en attente
 * ne donne aucun droit, sinon demander suffirait à regarder.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await ctx.params;

  /**
   * L'amitié est cherchée dans les DEUX sens : elle n'a pas d'orientation une
   * fois acceptée, et ne regarder qu'un sens donnerait un profil à celui qui a
   * demandé et rien à celui qui a accepté.
   */
  const lien = await prisma.amitie.findFirst({
    where: {
      etat: "acceptee",
      OR: [
        { demandeurId: user.id, receveurId: id },
        { demandeurId: id, receveurId: user.id },
      ],
    },
    select: { id: true },
  });
  if (!lien) {
    /**
     * 404 et non 403 : distinguer « pas votre ami » de « n'existe pas »
     * apprendrait, identifiant par identifiant, quels comptes existent. C'est
     * la même raison qui fait qu'un groupe plein rend la même réponse qu'un
     * code inconnu.
     */
    return NextResponse.json({ error: "Aucun joueur ne porte ce pseudo" }, { status: 404 });
  }

  const aujourdhui = jourLocal();
  const debut = debutFenetre(aujourdhui);

  const [compte, sommeSemaine, parties, jours, favori] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { id: true, pseudo: true, detteDepuis: true, dettePointsDus: true, partageAmis: true },
    }),
    prisma.paiement.aggregate({
      where: { userId: id, jour: { gte: debut, lte: aujourdhui } },
      _sum: { points: true },
    }),
    prisma.game.count({ where: { userId: id, sansEnjeu: false } }),
    prisma.paiement.findMany({
      where: { userId: id },
      select: { jour: true },
      orderBy: { jour: "desc" },
      take: 800,
    }),
    prisma.game.groupBy({
      by: ["jeu"],
      where: { userId: id, sansEnjeu: false },
      _count: { _all: true },
      orderBy: { _count: { jeu: "desc" } },
      take: 1,
    }),
  ]);
  if (!compte) return NextResponse.json({ error: "Aucun joueur ne porte ce pseudo" }, { status: 404 });

  const retard = etatRetard(compte.detteDepuis, compte.dettePointsDus);
  const listeJours = jours.map((p) => p.jour);

  return NextResponse.json(composerProfil(
    toPartage(compte.partageAmis),
    {
      pseudo: compte.pseudo,
      points: Math.max(0, sommeSemaine._sum.points ?? 0),
      enRetard: retard.enRetard,
      joursDeRetard: retard.jours,
    },
    {
      parties,
      serie: longueurSerie(listeJours, aujourdhui),
      meilleureSerie: meilleureSerie(listeJours),
      jeuFavori: favori[0]?.jeu ?? null,
    },
  ));
}
