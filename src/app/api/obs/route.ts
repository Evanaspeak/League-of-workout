import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * Le lien de la source de diffusion : l'obtenir, le refaire, le retirer.
 *
 * Il n'existe pas tant qu'on ne l'a pas demandé. C'est délibéré : une adresse
 * publique qui montre quelque chose de vous ne doit pas exister par défaut.
 */

/**
 * Trente-deux octets d'aléa véritable, en base64 URL.
 *
 * `Math.random` n'a rien à faire ici : un jeton devinable ouvre la page de
 * quelqu'un d'autre, et l'aléa du moteur JavaScript est prévisible à partir de
 * quelques tirages.
 */
function nouveauJeton(): string {
  return randomBytes(32).toString("base64url");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ jeton: user.jetonObs ?? null });
}

/** Crée le lien, ou le remplace. Remplacer invalide l'ancien du même coup. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const jeton = nouveauJeton();
  await prisma.user.update({ where: { id: user.id }, data: { jetonObs: jeton } });
  return NextResponse.json({ jeton });
}

/** Retire le lien. Il cesse aussitôt d'ouvrir quoi que ce soit. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  await prisma.user.update({ where: { id: user.id }, data: { jetonObs: null } });
  return NextResponse.json({ jeton: null });
}
