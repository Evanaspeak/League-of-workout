import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { estAdmin } from "@/lib/admin";

/**
 * Fait rejouer l'intro (accueil + visite guidée) à un compte.
 *
 * Les marques « déjà vu » vivent dans le navigateur de l'intéressé, hors de
 * portée d'ici. On incrémente donc la génération, qui entre dans la clé sous
 * laquelle elles sont rangées : les anciennes deviennent caduques d'un coup, et
 * sur tous ses appareils, sans que personne ait à effacer quoi que ce soit.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || !estAdmin(me.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const cible = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!cible) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const apres = await prisma.user.update({
    where: { id },
    data: { introGeneration: { increment: 1 } },
    select: { introGeneration: true },
  });

  return NextResponse.json({ ok: true, generation: apres.introGeneration });
}
