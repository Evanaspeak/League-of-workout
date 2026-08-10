import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcScore, calcScoreTemps, profilNeutre } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isExerciceId, prochainExercice, toExerciceId, toExerciceIds } from "@/lib/exercices";
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

  // Mêmes valeurs de repli que l'enregistrement, pour que l'aperçu annonce
  // exactement le chiffre qui sera écrit.
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

  // Même règle que l'enregistrement réel, pour que l'aperçu annonce le bon
  // exercice avant de valider.
  let exercice;
  if (isExerciceId(body.exercice)) {
    exercice = body.exercice;
  } else {
    // La sélection cochée dans le formulaire prime sur la préférence
    // enregistrée : on ne fait tourner que les exercices demandés ici.
    const selection = toExerciceIds(
      Array.isArray(body.exercices) && body.exercices.length > 0 ? body.exercices : user.exercices,
    );
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
