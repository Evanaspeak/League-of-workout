import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcScore } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth-helpers";

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

  const [roleWeights, levelConfigs, masteryConfig] = await Promise.all([
    prisma.roleWeight.findUnique({ where: { role: body.role } }),
    prisma.levelConfig.findMany({ orderBy: { seuilGainageSec: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  if (!roleWeights || !masteryConfig) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  // Compte les parties avant avec ce champion
  let partiesAvant = 0;
  if (body.champion && roleWeights.maitriseActive) {
    partiesAvant = await prisma.game.count({
      where: { userId: user.id, champion: body.champion },
    });
  }

  const gainageSec = body.gainageSec != null ? Number(body.gainageSec) : user.gainageMaxSec;

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
      source: body.source || "manuel",
      riotMatchId: body.riotMatchId || null,
    },
  });

  return NextResponse.json({ game, scoring });
}
