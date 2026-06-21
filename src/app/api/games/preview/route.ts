import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcScore } from "@/lib/scoring";

// Calcule sans sauvegarder — pour afficher le détail avant de logger
export async function POST(req: Request) {
  const body = await req.json();

  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  const [roleWeights, levelConfigs, masteryConfig] = await Promise.all([
    prisma.roleWeight.findUnique({ where: { role: body.role } }),
    prisma.levelConfig.findMany({ orderBy: { seuilGainageSec: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  if (!roleWeights || !masteryConfig) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  let partiesAvant = 0;
  if (body.champion && roleWeights.maitriseActive) {
    partiesAvant = await prisma.game.count({
      where: { userId: user.id, champion: body.champion },
    });
  }

  const scoring = calcScore({
    kills: Number(body.kills),
    deaths: Number(body.deaths),
    assists: Number(body.assists),
    result: body.result,
    gainageSec: user.gainageMaxSec,
    partiesAvant,
    roleWeights,
    levelConfigs,
    masteryConfig,
  });

  return NextResponse.json({ scoring, partiesAvant, gainageSec: user.gainageMaxSec });
}
