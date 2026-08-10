import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcScore, calcScoreTemps } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isExerciceId, prochainExercice, toExerciceId, toExerciceIds } from "@/lib/exercices";
import { normaliserNomJeu, typeDuJeu } from "@/lib/jeux";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const games = await prisma.game.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(games);
}

export async function POST(req: Request) {
  const body = await req.json();

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const jeu = normaliserNomJeu(body.jeu);
  const typeJeu = typeDuJeu(jeu, body.typeJeu);

  // Une session au temps n'a pas de rôle : interroger RoleWeight avec un
  // identifiant indéfini ferait échouer Prisma, et toute la session serait
  // perdue au moment de l'enregistrer.
  const [roleWeights, levelConfigs, masteryConfig] = await Promise.all([
    body.role ? prisma.roleWeight.findUnique({ where: { role: body.role } }) : null,
    prisma.levelConfig.findMany({ orderBy: { seuilGainageSec: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  if (typeJeu === "parties" && (!roleWeights || !masteryConfig)) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  // Compte les parties avant avec ce champion
  let partiesAvant = 0;
  if (body.champion && roleWeights?.maitriseActive) {
    partiesAvant = await prisma.game.count({
      where: { userId: user.id, champion: body.champion },
    });
  }

  const gainageSec = body.gainageSec != null ? Number(body.gainageSec) : user.gainageMaxSec;

  // Exercice de la partie : un choix explicite (ajout manuel) est respecté tel
  // quel ; sinon on avance d'un cran dans la rotation par rapport à la partie
  // précédente, pour répartir la charge entre les exercices cochés.
  let exercice;
  if (isExerciceId(body.exercice)) {
    exercice = body.exercice;
  } else {
    const selection = toExerciceIds(user.exercices);
    const derniere = selection.length > 1
      ? await prisma.game.findFirst({
          where: { userId: user.id },
          orderBy: { date: "desc" },
          select: { exercice: true },
        })
      : null;
    exercice = prochainExercice(selection, toExerciceId(derniere?.exercice));
  }

  if (typeJeu === "temps") {
    const dureeSec = Math.max(0, Math.round(Number(body.dureeSec) || 0));
    if (dureeSec <= 0) {
      return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    }
    const scoringTemps = calcScoreTemps({ dureeSec, gainageSec, levelConfigs });

    const game = await prisma.game.create({
      data: {
        userId: user.id,
        // Une session au temps n'a ni rôle, ni champion, ni résultat : ces
        // colonnes restent obligatoires en base, on y met des valeurs neutres.
        role: "—",
        champion: null,
        kills: 0,
        deaths: 0,
        assists: 0,
        result: "N",
        gainageSec,
        niveauCalcule: scoringTemps.niveau,
        partiesAvantCalcule: 0,
        surchargeCalculee: 0,
        scoreCalcule: scoringTemps.pointsFinaux,
        malusCalcule: 0,
        pompesCalculees: scoringTemps.pointsFinaux,
        exercice,
        jeu,
        typeJeu,
        dureeSec,
        source: body.source || "manuel",
        riotMatchId: null,
        ...(body.date ? { date: new Date(body.date) } : {}),
      },
    });

    return NextResponse.json({
      game,
      scoring: { ...scoringTemps, pompesFinales: scoringTemps.pointsFinaux },
    });
  }

  if (!roleWeights || !masteryConfig) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  const scoring = calcScore({
    kills: Number(body.kills),
    deaths: Number(body.deaths),
    assists: Number(body.assists),
    result: body.result,
    gainageSec,
    partiesAvant,
    roleWeights,
    levelConfigs,
    masteryConfig,
  });

  const game = await prisma.game.create({
    data: {
      userId: user.id,
      role: body.role,
      champion: body.champion || null,
      kills: Number(body.kills),
      deaths: Number(body.deaths),
      assists: Number(body.assists),
      result: body.result,
      gainageSec,
      niveauCalcule: scoring.niveau,
      partiesAvantCalcule: partiesAvant,
      surchargeCalculee: scoring.surcharge,
      scoreCalcule: scoring.scoreBase,
      malusCalcule: scoring.malus,
      pompesCalculees: scoring.pompesFinales,
      // Fige l'exercice retenu : l'historique reste fidèle même si la
      // sélection change plus tard.
      exercice,
      jeu,
      typeJeu,
      source: body.source || "manuel",
      riotMatchId: body.riotMatchId || null,
    },
  });

  return NextResponse.json({ game, scoring });
}
