import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";

const BETA_LIMIT = 100;

// Code lisible : pas de caractères ambigus (0/O, 1/l/I).
function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

function toIntOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (await isRateLimited(ip, "register")) {
      return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, { status: 429 });
    }
    await recordAttempt(ip, "register");

    const body = await request.json();
    const pseudo = String(body.pseudo ?? "").trim();

    // Pseudo : seul champ obligatoire.
    if (pseudo.length < 2) {
      return NextResponse.json({ error: "Pseudo trop court (min 2 caractères)" }, { status: 400 });
    }
    if (pseudo.length > 24) {
      return NextResponse.json({ error: "Pseudo trop long (max 24 caractères)" }, { status: 400 });
    }
    if (!/^[\p{L}\p{N} _.\-]+$/u.test(pseudo)) {
      return NextResponse.json({ error: "Pseudo invalide (lettres, chiffres, espaces uniquement)" }, { status: 400 });
    }

    const count = await prisma.user.count();
    if (count >= BETA_LIMIT) {
      return NextResponse.json({ error: "Beta complète — les 100 places sont prises." }, { status: 403 });
    }

    // Unicité côté appli (pas de contrainte DB : des pseudos existants sont dupliqués).
    const taken = await prisma.user.findFirst({
      where: { pseudo: { equals: pseudo, mode: "insensitive" } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "Ce pseudo est déjà pris. Choisis-en un autre." }, { status: 409 });
    }

    const code = generateCode();
    const passwordHash = await bcrypt.hash(code, 12);

    const user = await prisma.user.create({
      data: {
        pseudo,
        passwordHash,
        betaRank: count + 1,
        genre: body.genre ? String(body.genre) : null,
        age: toIntOrNull(body.age),
        poids: toIntOrNull(body.poids),
        taille: toIntOrNull(body.taille),
        sportsHoursPerWeek: toIntOrNull(body.sportsHoursPerWeek),
      },
    });

    await prisma.goal
      .create({ data: { userId: user.id, objectifTotalPompes: 1000 } })
      .catch(() => {});

    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
