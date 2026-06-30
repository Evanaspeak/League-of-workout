import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { sendBetaAcceptance } from "@/lib/email";

const ADMIN_EMAIL = "evantocquet@gmail.com";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const { status } = await req.json();

  if (!["pending", "accepted", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  try {
    const application = await prisma.betaApplication.update({
      where: { id },
      data: { status },
    });

    if (status === "accepted") {
      await sendBetaAcceptance(application.email, application.pseudo);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.betaApplication.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
