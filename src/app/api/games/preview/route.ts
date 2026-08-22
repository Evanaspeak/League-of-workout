import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calcScore, calcScoreBattleRoyale, calcScoreRocketLeague, calcScoreTemps,
  getLevel, getLevelParPompes, profilNeutre,
} from "@/lib/scoring";
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

  /**
   * Le niveau vient désormais du test de pompes enregistré sur le compte.
   * `gainageSec` n'est conservé que comme repli pour les comptes qui n'ont pas
   * encore fait le test, et pour rester lisible dans l'historique.
   */
  const gainageSec = body.gainageSec != null ? Number(body.gainageSec) : user.gainageMaxSec;
  const niveauCfg = user.pompesMax > 0
    ? getLevelParPompes(user.pompesMax, levelConfigs)
    : getLevel(gainageSec, levelConfigs);
  // Les fonctions de scoring choisissent le niveau à partir des secondes : on
  // leur passe le seuil du niveau retenu, pour qu'elles retombent dessus.
  const gainageEquivalent = niveauCfg.seuilGainageSec;

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
    const scoringTemps = calcScoreTemps({ dureeSec, gainageSec: gainageEquivalent, levelConfigs });
    return NextResponse.json({
      scoring: { ...scoringTemps, pompesFinales: scoringTemps.pointsFinaux },
      partiesAvant: 0,
      gainageSec,
      exercice,
      exercices: selection,
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
      placement, joueurs, kills: Number(body.kills) || 0, gainageSec: gainageEquivalent, roleWeights, levelConfigs,
    });
    return NextResponse.json({
      scoring: scoringBr,
      partiesAvant: 0,
      gainageSec,
      exercice,
      exercices: selection,
      repartition: repartirPoints(scoringBr.pompesFinales, selection),
      placement,
      joueurs,
    });
  }

  // Rocket League : trois statistiques positives, aucune qui pénalise.
  if (capacites.rl) {
    const scoringRl = calcScoreRocketLeague({
      buts: Number(body.kills) || 0,
      arrets: Number(body.arrets) || 0,
      passes: Number(body.assists) || 0,
      result: body.result === "V" ? "V" : "D",
      gainageSec: gainageEquivalent, roleWeights, levelConfigs,
    });
    return NextResponse.json({
      scoring: scoringRl,
      partiesAvant: 0,
      gainageSec,
      exercice,
      exercices: selection,
      repartition: repartirPoints(scoringRl.pompesFinales, selection),
    });
  }

  /**
   * `gainageEquivalent`, et non `gainageSec`.
   *
   * C'est le seuil du niveau retenu — celui que le test de pompes a fixé. Les
   * quatre autres barèmes le recevaient déjà ; celui des parties classiques,
   * non. Il repartait donc du gainage brut, c'est-à-dire d'un niveau qui
   * n'était plus le bon depuis que le niveau se lit sur le test de force.
   *
   * L'aperçu et l'enregistrement rendaient alors deux chiffres différents pour
   * la même partie. Sur l'overlay, où l'aperçu est appelé sans gainage, la
   * projection tombait au niveau de repli : quatre pompes annoncées pour dix
   * réellement dues. Un test compare désormais les deux routes.
   */
  const scoring = calcScore({
    kills: capacites.kda ? Number(body.kills) || 0 : 0,
    deaths: capacites.kda ? Number(body.deaths) || 0 : 0,
    assists: capacites.kda ? Number(body.assists) || 0 : 0,
    result: body.result === "V" ? "V" : "D",
    gainageSec: gainageEquivalent,
    partiesAvant,
    roleWeights,
    levelConfigs,
    masteryConfig,
  });

  return NextResponse.json({
    scoring, partiesAvant, gainageSec, exercice, exercices: selection,
    repartition: repartirPoints(scoring.pompesFinales, selection),
  });
}
