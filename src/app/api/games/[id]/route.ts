import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "Date manquante" }, { status: 400 });
  const result = await prisma.game.updateMany({
    where: { id, userId: user.id },
    data: { date: new Date(body.date) },
  });
  if (result.count === 0) return NextResponse.json({ error: "Game introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // On ne supprime que si la game appartient bien à l'utilisateur.
  const result = await prisma.game.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Game introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
