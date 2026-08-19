import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { ABONNEMENTS_MAX, endpointAcceptable, pushConfigure, notifier } from "@/lib/push";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

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
  const endpoint = body?.endpoint;
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!p256dh || !auth || p256dh.length > 256 || auth.length > 256) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }
  // L'adresse doit être celle d'un service de notification connu : c'est le
  // serveur qui l'appellera, et il appelait jusqu'ici ce qu'on lui donnait.
  if (!endpointAcceptable(endpoint)) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }

  // Un abonnement appartient à qui l'a enregistré. La clause portait sur la
  // seule adresse : connaître celle d'un autre suffisait à se l'attribuer et à
  // le priver de ses rappels.
  const existant = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  });
  if (existant && existant.userId !== user.id) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 409 });
  }

  // Le même navigateur peut se réabonner : on écrase plutôt que d'empiler.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth },
    create: { userId: user.id, endpoint, p256dh, auth },
  });

  // Plafond par compte. Sans lui, un seul `PUT` déclenchait autant d'appels
  // sortants que l'attaquant avait enregistré d'adresses.
  const trop = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: ABONNEMENTS_MAX,
    select: { id: true },
  });
  if (trop.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: trop.map((a) => a.id) } } });
  }

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

  // Une notification de test part vers tous les appareils du compte, à chaque
  // appel et sans limite : de quoi se harceler soi-même, et faire porter à
  // notre service d'envoi une charge que rien ne borne. Le compteur porte sur
  // le COMPTE et non sur l'adresse : c'est le compte qui reçoit.
  const cle = `push-test|${user.id}`;
  if (await isRateLimited(cle, "push-test")) {
    return NextResponse.json(
      { error: "Trop d'essais. Réessaie dans quelques minutes." },
      { status: 429 },
    );
  }
  await recordAttempt(cle, "push-test");

  const envoyees = await notifier(user.id, {
    titre: "Win or Workout",
    corps: "Les notifications fonctionnent. C'est tout ce qu'on voulait vérifier.",
    tag: "wow-test",
  });
  return NextResponse.json({ envoyees });
}
