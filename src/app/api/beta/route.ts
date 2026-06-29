import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBetaConfirmation } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pseudo, email, riotId, region, genre, age, poids, hoursPerWeek, sportsHoursPerWeek, currentSport, motivation, discovery, engagement } = body;

    if (!pseudo || !email || !riotId || !region || !genre || !age || !poids || !hoursPerWeek || !motivation || !discovery || !engagement) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail === "evantocquet@gmail.com") {
      await prisma.betaApplication.deleteMany({ where: { email: normalizedEmail } });
    } else {
      const existing = await prisma.betaApplication.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return NextResponse.json({ error: "Cette adresse email a déjà une candidature." }, { status: 409 });
      }
    }

    await prisma.betaApplication.create({
      data: {
        pseudo: String(pseudo).trim(),
        email: String(email).trim().toLowerCase(),
        riotId: String(riotId).trim(),
        region: String(region),
        genre: String(genre),
        age: Number(age),
        poids: Number(poids),
        hoursPerWeek: String(hoursPerWeek),
        sportsHoursPerWeek: Number(sportsHoursPerWeek ?? 0),
        currentSport: currentSport ? String(currentSport).trim() : null,
        motivation: String(motivation).trim(),
        discovery: String(discovery),
        engagement: Number(engagement),
      },
    });

    await sendBetaConfirmation(String(email).trim().toLowerCase(), String(pseudo).trim());

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
