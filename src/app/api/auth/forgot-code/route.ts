import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";
import { sendCodeReset } from "@/lib/email";

// Même alphabet que la génération de code initiale (beta-access) : lisible,
// sans caractères ambigus (0/O, 1/l/I).
function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    // Double limite : par IP (anti-flood) et par email (anti-harcèlement d'un compte précis).
    if (await isRateLimited(ip, "forgot-code")) {
      return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, { status: 429 });
    }
    if (await isRateLimited(email, "forgot-code")) {
      return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, { status: 429 });
    }
    await recordAttempt(ip, "forgot-code");
    await recordAttempt(email, "forgot-code");

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, pseudo: true, passwordHash: true },
    });

    // Réponse générique dans tous les cas : ne révèle jamais si l'email existe
    // ou si le compte a un code (vs. OAuth pur) — évite l'énumération de comptes.
    if (user && user.passwordHash) {
      const newCode = generateCode();
      const hash = await bcrypt.hash(newCode, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
      await sendCodeReset(email, user.pseudo, newCode);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
