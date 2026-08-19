import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";
import { empreinte, PREFIXE_RESET } from "@/lib/recuperation";

/** Même alphabet que la génération initiale : lisible, sans 0/O ni 1/l/I. */
function genererCode(longueur = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const octets = randomBytes(longueur);
  return Array.from(octets).map((b) => chars[b % chars.length]).join("");
}

/**
 * Applique la récupération : c'est ici, et seulement ici, que l'ancien code
 * cesse de fonctionner.
 *
 * La demande de récupération ne touche à rien ; elle envoie un lien. Ouvrir ce
 * lien prouve qu'on relève bien la boîte de l'adresse concernée, ce qui est la
 * seule preuve que la route précédente ne demandait pas.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (await isRateLimited(ip, "forgot-code")) {
      return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, { status: 429 });
    }
    await recordAttempt(ip, "forgot-code");

    const body = await request.json().catch(() => null);
    const jeton = typeof body?.token === "string" ? body.token : "";
    if (jeton.length < 20 || jeton.length > 200) {
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });
    }

    // On retrouve la demande par l'empreinte du jeton : l'adresse n'a pas
    // besoin de circuler dans l'URL, donc elle ne traîne pas dans l'historique.
    const demande = await prisma.verificationToken.findFirst({
      where: { token: empreinte(jeton), identifier: { startsWith: PREFIXE_RESET } },
    });
    if (!demande || demande.expires < new Date()) {
      if (demande) {
        await prisma.verificationToken.deleteMany({ where: { token: demande.token } });
      }
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });
    }

    const email = demande.identifier.slice(PREFIXE_RESET.length);
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, pseudo: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      await prisma.verificationToken.deleteMany({ where: { token: demande.token } });
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });
    }

    const code = genererCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(code, 12),
        // Le nouveau code périme les sessions ouvertes avec l'ancien : sans ça,
        // récupérer son compte ne mettrait pas dehors qui s'y trouvait déjà.
        sessionEpoch: { increment: 1 },
      },
    });

    // Usage unique : le lien ne resservira pas, même s'il traîne quelque part.
    await prisma.verificationToken.deleteMany({ where: { token: demande.token } });

    return NextResponse.json({ code, pseudo: user.pseudo });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
