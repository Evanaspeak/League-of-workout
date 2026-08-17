import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { pushConfigure, notifier } from "@/lib/push";

/** État des notifications pour le compte courant. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const appareils = await prisma.pushSubscription.count({ where: { userId: user.id } });
  return NextResponse.json({ disponible: pushConfigure(), appareils });
}

/** Enregistre l'abonnement du navigateur courant. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!pushConfigure()) {
    return NextResponse.json({ error: "Notifications non configurées" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }

  // Le même navigateur peut se réabonner : on écrase plutôt que d'empiler.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth },
    create: { userId: user.id, endpoint, p256dh, auth },
  });

  return NextResponse.json({ ok: true });
}

/** Retire l'abonnement de ce navigateur, ou tous si aucun n'est précisé. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;

  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id, ...(endpoint ? { endpoint } : {}) },
  });
  return NextResponse.json({ ok: true });
}

/** Envoi de contrôle, pour vérifier que tout est branché de bout en bout. */
export async function PUT() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const envoyees = await notifier(user.id, {
    titre: "Win or Workout",
    corps: "Les notifications fonctionnent. C'est tout ce qu'on voulait vérifier.",
    tag: "wow-test",
  });
  return NextResponse.json({ envoyees });
}
