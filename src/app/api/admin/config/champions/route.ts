import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { CHAMPIONS } from "@/lib/champions";

const ADMIN_EMAIL = "evantocquet@gmail.com";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const config = await prisma.systemConfig.findUnique({ where: { key: "champions" } });
  if (!config) return NextResponse.json({ champions: CHAMPIONS, isDefault: true });
  return NextResponse.json({ champions: JSON.parse(config.value), isDefault: false });
}

export async function PUT(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const { champions } = await req.json();
  if (!Array.isArray(champions)) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const cleaned = champions.map((c: string) => String(c).trim()).filter(Boolean);
  await prisma.systemConfig.upsert({
    where: { key: "champions" },
    update: { value: JSON.stringify(cleaned) },
    create: { key: "champions", value: JSON.stringify(cleaned) },
  });
  return NextResponse.json({ ok: true, count: cleaned.length });
}

export async function DELETE() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  await prisma.systemConfig.deleteMany({ where: { key: "champions" } });
  return NextResponse.json({ ok: true });
}
