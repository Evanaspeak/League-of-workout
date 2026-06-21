import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDefaults } from "@/lib/seed-defaults";

export async function GET() {
  await seedDefaults();
  const user = await prisma.user.findFirst();
  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      pseudo: body.pseudo,
      riotId: body.riotId,
      riotRegion: body.riotRegion,
      gainageMaxSec: Number(body.gainageMaxSec),
      ...(body.riotPuuid ? { riotPuuid: body.riotPuuid } : {}),
    },
  });

  // Met à jour l'objectif si fourni
  if (body.objectifTotalPompes !== undefined) {
    const existing = await prisma.goal.findUnique({ where: { userId: user.id } });
    if (existing) {
      await prisma.goal.update({ where: { userId: user.id }, data: { objectifTotalPompes: Number(body.objectifTotalPompes) } });
    } else {
      await prisma.goal.create({ data: { userId: user.id, objectifTotalPompes: Number(body.objectifTotalPompes) } });
    }
  }

  return NextResponse.json(updated);
}
