import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const ADMIN_EMAIL = "evantocquet@gmail.com";

function generatePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, passwordHash: true } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  if (!user.passwordHash) {
    return NextResponse.json({ error: "Ce compte utilise Google ou Discord — pas de mot de passe à réinitialiser" }, { status: 400 });
  }

  const newPassword = generatePassword();
  const hash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({ where: { id }, data: { passwordHash: hash } });

  return NextResponse.json({ password: newPassword });
}
