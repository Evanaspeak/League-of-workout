import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "evantocquet@gmail.com";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Protect admin account from self-deletion
  if (id === me.id) {
    return NextResponse.json({ error: "Impossible de supprimer son propre compte" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
