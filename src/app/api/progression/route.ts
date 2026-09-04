import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estJourValide, jourLocal } from "@/lib/serie";
import { reponseBadges, reponseSerie } from "@/lib/progression";
import { composerExploits } from "@/lib/exploits";
import { avancementDefi, defiDuJour } from "@/lib/defiQuotidien";

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
  //
  // Le contrôle porte sur l'aller-retour et non sur la seule forme :
  // « 9999-99-99 » respecte le motif, n'est pas une date, et passait — il
  // rendait alors une série de zéro en court-circuitant le repli prévu pour
  // ce cas exact. La règle vit dans `estJourValide`, avec celle de
  // `/api/dashboard/daily` qui la portait seule.
  const demande = new URL(req.url).searchParams.get("jour");
  const aujourdhui = estJourValide(demande) ? demande : jourLocal();

  const [agregat, paiements, partiesDuJour] = await Promise.all([
    prisma.game.aggregate({
      // Même raison que dans `/api/badges`, dont cette route reprend le calcul.
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
      // Une série ne remonte jamais bien loin, et la meilleure se recalcule sur
      // ce qu'on lit : deux ans de paiements quotidiens tiennent largement.
      orderBy: { jour: "desc" },
      take: 800,
    }),
    /**
     * Les parties du jour, et elles seules : c'est le seul aller-retour que le
     * défi quotidien ajoute, et il porte sur une poignée de lignes.
     *
     * Les bornes sont en UTC, comme dans `/api/dashboard/daily` qui découpe
     * déjà les journées ainsi. C'est une approximation pour qui joue loin du
     * méridien — et c'est la MÊME dans les deux endroits, ce qui vaut mieux
     * qu'une seconde règle qui divergerait à la première correction.
     */
    prisma.game.findMany({
      where: {
        userId: user.id,
        sansEnjeu: false,
        date: {
          gte: new Date(`${aujourdhui}T00:00:00.000Z`),
          lte: new Date(`${aujourdhui}T23:59:59.999Z`),
        },
      },
      select: { result: true, jeu: true },
    }),
  ]);

  const source = {
    totalPoints: agregat._sum.pompesCalculees ?? 0,
    parties: agregat._count._all ?? 0,
    jours: paiements.map((p) => p.jour),
    pointsPayes: paiements.reduce((somme, p) => somme + p.points, 0),
  };

  return NextResponse.json({
    badges: reponseBadges(source),
    serie: reponseSerie(source, aujourdhui, user),
    /**
     * Les exploits se lisent sur le COMPTE, déjà chargé par la session : ils
     * ne coûtent aucune requête. C'est ce qui rend acceptable de les ranger en
     * base plutôt que de les déduire — le prix se paie à l'écriture, une fois,
     * et jamais à la lecture.
     */
    exploits: composerExploits(user),
    /**
     * Le défi du jour, avec son avancement.
     *
     * Il vit ici et pas dans une route à lui pour la raison déjà écrite trois
     * fois dans ce fichier : il se mesure sur des lignes qu'on vient de lire.
     * Le tirage, lui, ne dépend que du JOUR — donc du navigateur, comme la
     * série, parce qu'un défi de vingt-quatre heures se compte sur les
     * vingt-quatre heures de celui qui le fait.
     */
    defi: (() => {
      const paiementsDuJour = paiements.filter((p) => p.jour === aujourdhui);
      return {
        ...avancementDefi(defiDuJour(aujourdhui), {
          partiesDuJour: partiesDuJour.length,
          victoiresDuJour: partiesDuJour.filter((g) => g.result === "V").length,
          jeuxDuJour: new Set(partiesDuJour.map((g) => g.jeu).filter(Boolean)).size,
          pointsPayesDuJour: paiementsDuJour.reduce((somme, p) => somme + p.points, 0),
          seancesDuJour: paiementsDuJour.length,
        }),
      };
    })(),
  });
}
