import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcScore, calcScoreBattleRoyale, calcScoreTemps, profilNeutre } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isExerciceId, repartirPoints, toExerciceIds } from "@/lib/exercices";
import { capacitesDuJeu, normaliserNomJeu, typeDuJeu } from "@/lib/jeux";

// Calcule sans sauvegarder — pour afficher le détail avant de logger
export async function POST(req: Request) {
  const body = await req.json();

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const jeu = normaliserNomJeu(body.jeu);
  const typeJeu = typeDuJeu(jeu, body.typeJeu);

  // Ce que le jeu permet de renseigner : un CS n'a ni lane ni champion.
  const capacites = capacitesDuJeu(jeu, body.typeJeu);

  const [ponderations, levelConfigs, masteryConfig] = await Promise.all([
    prisma.roleWeight.findMany(),
    prisma.levelConfig.findMany({ orderBy: { seuilGainageSec: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  // Avec des lanes, on prend celle de la partie ; sans lanes, un profil neutre
  // dérivé des réglages du joueur.
  const roleWeights = capacites.roles
    ? (ponderations.find((r) => r.role === body.role) ?? null)
    : profilNeutre(ponderations);

  if (typeJeu === "parties" && (!roleWeights || !masteryConfig)) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  let partiesAvant = 0;
  if (capacites.champions && body.champion && roleWeights?.maitriseActive) {
    partiesAvant = await prisma.game.count({
      where: { userId: user.id, champion: body.champion },
    });
  }

  const gainageSec = body.gainageSec != null ? Number(body.gainageSec) : user.gainageMaxSec;

  // Mêmes exercices que l'enregistrement réel : l'aperçu annonce exactement ce
  // qu'il y aura à faire.
  const selection = isExerciceId(body.exercice)
    ? [body.exercice]
    : toExerciceIds(
        Array.isArray(body.exercices) && body.exercices.length > 0 ? body.exercices : user.exercices,
      );
  const exercice = selection[0];


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
      exercice,
      repartition: repartirPoints(scoringTemps.pointsFinaux, selection),
      typeJeu,
      dureeSec,
    });
  }

  if (!roleWeights || !masteryConfig) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  // Mêmes règles que l'enregistrement, pour que l'aperçu annonce exactement le
  // chiffre qui sera écrit.
  if (capacites.br) {
    const placement = Math.max(1, Math.round(Number(body.placement) || 0));
    const joueurs = Math.max(2, Math.round(Number(body.joueurs) || capacites.joueurs));
    if (!Number(body.placement)) {
      return NextResponse.json({ error: "Classement invalide" }, { status: 400 });
    }
    const scoringBr = calcScoreBattleRoyale({
      placement, joueurs, kills: Number(body.kills) || 0, gainageSec, roleWeights, levelConfigs,
    });
    return NextResponse.json({
      scoring: scoringBr,
      partiesAvant: 0,
      gainageSec,
      exercice,
      repartition: repartirPoints(scoringBr.pompesFinales, selection),
      placement,
      joueurs,
    });
  }

  const scoring = calcScore({
    kills: capacites.kda ? Number(body.kills) || 0 : 0,
    deaths: capacites.kda ? Number(body.deaths) || 0 : 0,
    assists: capacites.kda ? Number(body.assists) || 0 : 0,
    result: body.result === "V" ? "V" : "D",
    gainageSec,
    partiesAvant,
    roleWeights,
    levelConfigs,
    masteryConfig,
  });

  return NextResponse.json({
    scoring, partiesAvant, gainageSec, exercice,
    repartition: repartirPoints(scoring.pompesFinales, selection),
  });
}
