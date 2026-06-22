import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDefaults } from "@/lib/seed-defaults";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  await seedDefaults();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      pseudo: body.pseudo,
      riotId: body.riotId,
      riotRegion: body.riotRegion,
      // gainageMaxSec est optionnel : la valeur est maintenant saisie à chaque session.
      ...(body.gainageMaxSec != null ? { gainageMaxSec: Number(body.gainageMaxSec) } : {}),
      ...(body.riotPuuid ? { riotPuuid: body.riotPuuid } : {}),
    },
  });

  // Met à jour l'objectif si fourni
  if (body.objectifTotalPompes !== undefined) {
    await prisma.goal.upsert({
      where: { userId: user.id },
      update: { objectifTotalPompes: Number(body.objectifTotalPompes) },
      create: { userId: user.id, objectifTotalPompes: Number(body.objectifTotalPompes) },
    });
  }

  return NextResponse.json(updated);
}
