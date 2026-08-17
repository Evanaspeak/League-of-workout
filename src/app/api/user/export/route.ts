import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * Export de toutes les données personnelles, au titre du droit à la
 * portabilité. Le format est du JSON lisible : quelqu'un doit pouvoir ouvrir
 * le fichier et comprendre ce qu'on garde sur lui sans outil particulier.
 *
 * Rien de ce qui relève du secret ne sort d'ici — ni empreinte de mot de
 * passe, ni jeton de session, ni clé d'abonnement aux notifications.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [games, goal, abonnements] = await Promise.all([
    prisma.game.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
    prisma.pushSubscription.findMany({
      where: { userId: user.id },
      select: { createdAt: true },
    }),
  ]);

  const donnees = {
    exportLe: new Date().toISOString(),
    compte: {
      pseudo: user.pseudo,
      email: user.email,
      inscritLe: user.createdAt,
      rangBeta: user.betaRank,
      riotId: user.riotId,
      riotRegion: user.riotRegion,
      genre: user.genre,
      age: user.age,
      poids: user.poids,
      taille: user.taille,
      heuresDeSportParSemaine: user.sportsHoursPerWeek,
    },
    preferences: {
      exercices: user.exercices,
      pompesMax: user.pompesMax,
      pompesMaxLe: user.pompesMaxLe,
      seuilRappelBoxeSec: user.rappelSeuilSec,
      plafondQuotidienPoints: user.plafondQuotidien,
      objectifTotalPoints: goal?.objectifTotalPompes ?? null,
    },
    detteEnAttentePoints: user.dettePointsDus,
    // On ne sort que la date d'inscription de chaque appareil : les clés
    // permettraient de lui envoyer des notifications.
    appareilsNotifies: abonnements.map((a) => ({ ajouteLe: a.createdAt })),
    activites: games.map((g) => ({
      date: g.date,
      jeu: g.jeu,
      typeJeu: g.typeJeu,
      role: g.role,
      champion: g.champion,
      kills: g.kills,
      morts: g.deaths,
      assists: g.assists,
      arrets: g.arrets,
      placement: g.placement,
      equipes: g.joueurs,
      resultat: g.result,
      dureeSec: g.dureeSec,
      gainageSec: g.gainageSec,
      niveau: g.niveauCalcule,
      coutPoints: g.pompesCalculees,
      exercice: g.exercice,
      repartition: g.repartition,
      source: g.source,
    })),
  };

  const jour = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(donnees, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="win-or-workout-${jour}.json"`,
      // Des données personnelles n'ont rien à faire dans un cache partagé.
      "Cache-Control": "no-store",
    },
  });
}
