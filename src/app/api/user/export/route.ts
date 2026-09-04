import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * Export de toutes les données personnelles, au titre du droit à la
 * portabilité. Le format est du JSON lisible : quelqu'un doit pouvoir ouvrir
 * le fichier et comprendre ce qu'on garde sur lui sans outil particulier.
 *
 * Rien de ce qui relève du secret ne sort d'ici : ni empreinte de mot de
 * passe, ni jeton de session, ni clé d'abonnement aux notifications, ni jeton
 * de la source de diffusion. Ce dernier est bien une donnée du compte, mais
 * c'est aussi un laissez-passer : le mettre dans un fichier qu'on s'envoie par
 * courriel en ferait une clé qui traîne.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [games, goal, abonnements, paiements, signalements] = await Promise.all([
    prisma.game.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
    prisma.pushSubscription.findMany({
      where: { userId: user.id },
      select: { createdAt: true },
    }),
    /**
     * Les séances payées manquaient à cet export.
     *
     * C'est pourtant la moitié de ce que l'application sait de quelqu'un — et
     * la moitié qu'il a envie de reprendre. Les parties disent ce qu'il a joué,
     * les paiements disent ce qu'il a FAIT.
     */
    prisma.paiement.findMany({
      where: { userId: user.id },
      orderBy: { jour: "asc" },
      select: { jour: true, points: true, createdAt: true },
    }),
    // Ce qu'il nous a écrit lui appartient aussi.
    prisma.signalement.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, message: true, page: true, statut: true },
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
      langue: user.langue,
      fuseau: user.fuseau,
      /**
       * La trace du consentement aux données de santé.
       *
       * C'est à nous de prouver qu'il a été donné (article 7.1) ; il est
       * normal que la personne reçoive la même preuve.
       */
      santeConsentiLe: user.santeConsentiLe,
      santeRefuseLe: user.santeRefuseLe,
    },
    preferences: {
      exercices: user.exercices,
      pompesMax: user.pompesMax,
      pompesMaxLe: user.pompesMaxLe,
      seuilRappelBoxeSec: user.rappelSeuilSec,
      plafondQuotidienPoints: user.plafondQuotidien,
      objectifTotalPoints: goal?.objectifTotalPompes ?? null,
      variantePompes: user.variantePompes,
      exercicesSuspendus: user.exercicesSuspendus,
      suspensionDepuis: user.suspensionDepuis,
      bilanHebdomadaire: user.bilanActif,
    },
    detteEnAttentePoints: user.dettePointsDus,
    detteDepuis: user.detteDepuis,
    /**
     * La première dette soldée dans l'heure.
     *
     * Elle ne voyage pas dans les réponses ordinaires — l'écran n'a besoin que
     * d'un booléen — mais l'article 20 couvre TOUT ce qu'on garde, pas
     * seulement ce qu'on affiche. Une donnée qu'on ne montre pas est
     * précisément celle qu'on oublie d'exporter.
     */
    premierPaiementEclairLe: user.paiementEclairLe,
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
    /** Chaque séance faite, jour par jour. */
    seances: paiements.map((p) => ({
      jour: p.jour,
      pointsAcquittes: p.points,
      enregistreLe: p.createdAt,
    })),
    signalements: signalements.map((r) => ({
      envoyeLe: r.createdAt,
      page: r.page,
      message: r.message,
      statut: r.statut,
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
