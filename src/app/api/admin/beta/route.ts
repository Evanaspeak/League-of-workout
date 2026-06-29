import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

const ADMIN_EMAIL = "evantocquet@gmail.com";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    const applications = await prisma.betaApplication.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ applications });
  } catch {
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
