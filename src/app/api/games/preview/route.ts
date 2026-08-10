import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcScore, calcScoreTemps } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isExerciceId, prochainExercice, toExerciceId, toExerciceIds } from "@/lib/exercices";
import { normaliserNomJeu, typeDuJeu } from "@/lib/jeux";

// Calcule sans sauvegarder — pour afficher le détail avant de logger
export async function POST(req: Request) {
  const body = await req.json();

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const jeu = normaliserNomJeu(body.jeu);
  const typeJeu = typeDuJeu(jeu, body.typeJeu);

  // Sans rôle (session au temps), on n'interroge pas RoleWeight : Prisma
  // refuse un findUnique dont la clé est indéfinie.
  const [roleWeights, levelConfigs, masteryConfig] = await Promise.all([
    body.role ? prisma.roleWeight.findUnique({ where: { role: body.role } }) : null,
    prisma.levelConfig.findMany({ orderBy: { seuilGainageSec: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  if (typeJeu === "parties" && (!roleWeights || !masteryConfig)) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  let partiesAvant = 0;
  if (body.champion && roleWeights?.maitriseActive) {
    partiesAvant = await prisma.game.count({
      where: { userId: user.id, champion: body.champion },
    });
  }

  const gainageSec = body.gainageSec != null ? Number(body.gainageSec) : user.gainageMaxSec;

  // Session au temps : la dette dépend de la durée, pas d'un résultat.
  if (typeJeu === "temps") {
    const dureeSec = Math.max(0, Math.round(Number(body.dureeSec) || 0));
    if (dureeSec <= 0) {
      return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    }
    const scoringTemps = calcScoreTemps({ dureeSec, gainageSec, levelConfigs });
    return NextResponse.json({
      scoring: { ...scoringTemps, pompesFinales: scoringTemps.pointsFinaux },
      partiesAvant: 0,
      gainageSec,
      exercice: isExerciceId(body.exercice) ? body.exercice : toExerciceId(user.exercices?.[0]),
      typeJeu,
      dureeSec,
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

  // Même règle que l'enregistrement réel, pour que l'aperçu annonce le bon
  // exercice avant de valider.
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

  return NextResponse.json({ scoring, partiesAvant, gainageSec, exercice });
}
