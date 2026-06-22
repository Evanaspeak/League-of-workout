import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcScore } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth-helpers";

// Calcule sans sauvegarder — pour afficher le détail avant de logger
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

  return NextResponse.json({ scoring, partiesAvant, gainageSec });
}
