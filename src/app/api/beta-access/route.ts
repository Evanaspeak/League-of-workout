import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";
import { normaliserEmail, pseudoDejaPris, validerPseudo } from "@/lib/identite";

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
    // Pseudo : seul champ obligatoire. Les règles vivent dans `identite`, avec
    // celles des deux autres chemins d'écriture — c'est leur divergence qui a
    // ouvert l'escalade d'administrateur.
    const verdict = validerPseudo(body.pseudo);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.erreur }, { status: verdict.statut });
    }
    const pseudo = verdict.valeur;

    // Email optionnel (pour la récupération de compte). Si fourni : valider + unicité.
    let email: string | null = null;
    if (body.email) {
      email = normaliserEmail(body.email);
      if (!email) {
        return NextResponse.json({ error: "Email invalide" }, { status: 400 });
      }
      const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (emailTaken) {
        return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
      }
    }

    const count = await prisma.user.count();
    if (count >= BETA_LIMIT) {
      return NextResponse.json({ error: "Beta complète — les 100 places sont prises." }, { status: 403 });
    }

    // Unicité côté appli (pas de contrainte DB : des pseudos existants sont dupliqués).
    if (await pseudoDejaPris(pseudo)) {
      return NextResponse.json({ error: "Ce pseudo est déjà pris. Choisis-en un autre." }, { status: 409 });
    }

    const code = generateCode();
    const passwordHash = await bcrypt.hash(code, 12);

    const user = await prisma.user.create({
      data: {
        pseudo,
        email,
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
