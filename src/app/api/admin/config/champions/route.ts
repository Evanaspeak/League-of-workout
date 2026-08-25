import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { CHAMPIONS } from "@/lib/champions";
import { estAdmin } from "@/lib/admin";


async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !estAdmin(user.email)) return null;
  return user;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: "champions" } });
    if (config) return NextResponse.json({ champions: JSON.parse(config.value), isDefault: false });
  } catch {
    // Une valeur illisible se présente comme une absence de valeur : le panneau
    // montre alors la liste par défaut, ce qui est aussi ce qu'il montrerait
    // après une remise à zéro. Il n'y a rien de mieux à faire ici, et le
    // panneau reste utilisable.
  }
  return NextResponse.json({ champions: CHAMPIONS, isDefault: true });
}

export async function PUT(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const { champions } = await req.json();
  if (!Array.isArray(champions)) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const cleaned = champions.map((c: string) => String(c).trim()).filter(Boolean);
  try {
    await prisma.systemConfig.upsert({
      where: { key: "champions" },
      update: { value: JSON.stringify(cleaned) },
      create: { key: "champions", value: JSON.stringify(cleaned) },
    });
    return NextResponse.json({ ok: true, count: cleaned.length });
  } catch {
    return NextResponse.json({ error: "Erreur base de données : la table SystemConfig n'existe pas encore." }, { status: 500 });
  }
}

export async function DELETE() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  try {
    await prisma.systemConfig.deleteMany({ where: { key: "champions" } });
  } catch {}
  return NextResponse.json({ ok: true });
}
