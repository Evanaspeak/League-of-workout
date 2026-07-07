import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";

const BETA_LIMIT = 100;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (await isRateLimited(ip, "register")) {
      return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, { status: 429 });
    }
    await recordAttempt(ip, "register");

    const { email, password, pseudo } = await request.json();

    if (!email || !password || !pseudo) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Mot de passe trop court (min 8 caractères)" }, { status: 400 });
    }
    if (typeof pseudo !== "string" || pseudo.trim().length < 2) {
      return NextResponse.json({ error: "Pseudo trop court (min 2 caractères)" }, { status: 400 });
    }

    const count = await prisma.user.count();
    if (count >= BETA_LIMIT) {
      return NextResponse.json({ error: "Beta complète — les 100 places sont prises." }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        pseudo: pseudo.trim(),
        passwordHash,
        betaRank: count + 1,
      },
    });

    await prisma.goal
      .create({ data: { userId: user.id, objectifTotalPompes: 1000 } })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
