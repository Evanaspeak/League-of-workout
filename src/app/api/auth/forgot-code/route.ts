import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";
import { sendResetLink, SITE_URL } from "@/lib/email";
import { normaliserEmail } from "@/lib/identite";
import { empreinte, PREFIXE_RESET, VALIDITE_MS } from "@/lib/recuperation";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const body = await request.json().catch(() => null);
    const email = normaliserEmail(body?.email);

    if (!email) {
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
      // Cette demande ne change RIEN sur le compte. Elle écrasait le mot de
      // passe sur-le-champ : quiconque connaissait l'adresse de quelqu'un lui
      // faisait donc tourner son identifiant sans qu'il ait rien demandé, et
      // l'e-mail lui promettait pourtant le contraire. C'est l'ouverture du
      // lien qui déclenche le remplacement, et elle seule.
      const jeton = randomBytes(32).toString("base64url");
      const identifier = `${PREFIXE_RESET}${email}`;

      // Une demande en cours remplace la précédente : deux liens vivants pour
      // un même compte doubleraient la surface sans rien apporter.
      await prisma.verificationToken.deleteMany({ where: { identifier } });
      await prisma.verificationToken.create({
        data: {
          identifier,
          token: empreinte(jeton),
          expires: new Date(Date.now() + VALIDITE_MS),
        },
      });

      const lien = `${SITE_URL}/recuperation/valider?t=${encodeURIComponent(jeton)}`;
      await sendResetLink(email, user.pseudo, lien);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
