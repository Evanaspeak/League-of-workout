import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcScore, calcScoreBattleRoyale, calcScoreTemps, profilNeutre } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isExerciceId, prochainExercice, toExerciceId, toExerciceIds } from "@/lib/exercices";
import { capacitesDuJeu, normaliserNomJeu, typeDuJeu } from "@/lib/jeux";

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

  // Compte les parties avant avec ce champion
  let partiesAvant = 0;
  if (capacites.champions && body.champion && roleWeights?.maitriseActive) {
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

  // Un jeu sans lane ni KDA n'envoie pas ces champs : on les ramène à des
  // valeurs sûres, sinon Prisma reçoit undefined ou NaN sur des colonnes
  // obligatoires.
  const role = capacites.roles && body.role ? String(body.role) : "—";
  // Un battle royale compte ses éliminations, mais ni morts ni assists.
  const kills = capacites.kda || capacites.br ? Number(body.kills) || 0 : 0;
  const deaths = capacites.kda ? Number(body.deaths) || 0 : 0;
  const assists = capacites.kda ? Number(body.assists) || 0 : 0;
  const champion = capacites.champions && body.champion ? String(body.champion) : null;

  // Battle royale : la place finale remplace le compteur de morts, et la
  // victoire se déduit du classement plutôt que d'un bouton.
  const placement = capacites.br ? Math.max(1, Math.round(Number(body.placement) || 0)) : null;
  const joueurs = capacites.br ? Math.max(2, Math.round(Number(body.joueurs) || capacites.joueurs)) : null;
  if (capacites.br && !Number(body.placement)) {
    return NextResponse.json({ error: "Classement invalide" }, { status: 400 });
  }
  const resultat = capacites.br
    ? (placement === 1 ? "V" : "D")
    : (body.result === "V" ? "V" : "D");

  const scoring = capacites.br && placement !== null && joueurs !== null
    ? calcScoreBattleRoyale({ placement, joueurs, kills, gainageSec, roleWeights, levelConfigs })
    : calcScore({
        kills,
        deaths,
        assists,
        result: resultat,
        gainageSec,
        partiesAvant,
        roleWeights,
        levelConfigs,
        masteryConfig,
      });

  const game = await prisma.game.create({
    data: {
      userId: user.id,
      role,
      champion,
      kills,
      deaths,
      assists,
      result: resultat,
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
      placement,
      joueurs,
      source: body.source || "manuel",
      riotMatchId: body.riotMatchId || null,
    },
  });

  return NextResponse.json({ game, scoring });
}
