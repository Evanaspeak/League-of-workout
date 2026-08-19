import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { estAdmin } from "@/lib/admin";


function generatePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || !estAdmin(me.email)) {
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
  // Réinitialiser sans périmer les sessions ne sécurisait rien : un intrus qui
  // détenait déjà un jeton le gardait bon trente jours, et l'administrateur
  // croyait le compte repris en main.

  await prisma.user.update({
    where: { id },
    data: { passwordHash: hash, sessionEpoch: { increment: 1 } },
  });

  return NextResponse.json({ password: newPassword });
}
