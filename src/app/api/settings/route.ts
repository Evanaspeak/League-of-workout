import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isExerciceId } from "@/lib/exercices";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [roleWeights, levelConfigs, masteryConfig, goal] = await Promise.all([
    prisma.roleWeight.findMany({ orderBy: { role: "asc" } }),
    prisma.levelConfig.findMany({ orderBy: { niveau: "asc" } }),
    prisma.masteryConfig.findFirst(),
    prisma.goal.findUnique({ where: { userId: user.id } }),
  ]);
  return NextResponse.json({ roleWeights, levelConfigs, masteryConfig, goal, user });
}

export async function PUT(req: Request) {
  const body = await req.json();

  const updates: Promise<unknown>[] = [];

  // Préférences propres à l'utilisateur : toujours authentifiées et scopées à
  // son propre compte (contrairement à la config de scoring, volontairement
  // partagée entre bêta-testeurs).
  if (body.userPrefs) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const data: { exercice?: string; rappelSeuilPoints?: number } = {};

    if (body.userPrefs.exercice !== undefined) {
      if (!isExerciceId(body.userPrefs.exercice)) {
        return NextResponse.json({ error: "Exercice inconnu" }, { status: 400 });
      }
      data.exercice = body.userPrefs.exercice;
    }

    if (body.userPrefs.rappelSeuilPoints !== undefined) {
      const seuil = Number(body.userPrefs.rappelSeuilPoints);
      if (!Number.isFinite(seuil) || seuil < 0 || seuil > 1000) {
        return NextResponse.json({ error: "Seuil de rappel invalide" }, { status: 400 });
      }
      data.rappelSeuilPoints = Math.round(seuil);
    }

    if (Object.keys(data).length > 0) {
      updates.push(prisma.user.update({ where: { id: user.id }, data }));
    }
  }

  if (body.roleWeights) {
    for (const rw of body.roleWeights) {
      updates.push(
        prisma.roleWeight.update({
          where: { role: rw.role },
          data: {
            poidsMort: Number(rw.poidsMort),
            poidsKill: Number(rw.poidsKill),
            poidsAssist: Number(rw.poidsAssist),
            maitriseActive: Boolean(rw.maitriseActive),
          },
        })
      );
    }
  }

  if (body.levelConfigs) {
    for (const lc of body.levelConfigs) {
      updates.push(
        prisma.levelConfig.update({
          where: { niveau: Number(lc.niveau) },
          data: {
            seuilGainageSec: Number(lc.seuilGainageSec),
            multiplicateur: Number(lc.multiplicateur),
            malusDefaite: Number(lc.malusDefaite),
          },
        })
      );
    }
  }

  if (body.masteryConfig) {
    updates.push(
      prisma.masteryConfig.update({
        where: { id: 1 },
        data: {
          surchargeMax: Number(body.masteryConfig.surchargeMax),
          partiesPourMax: Number(body.masteryConfig.partiesPourMax),
        },
      })
    );
  }

  await Promise.all(updates);
  return NextResponse.json({ ok: true });
}
