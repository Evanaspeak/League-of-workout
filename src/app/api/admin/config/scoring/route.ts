import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "evantocquet@gmail.com";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [roles, levels, mastery] = await Promise.all([
    prisma.roleWeight.findMany({ orderBy: { role: "asc" } }),
    prisma.levelConfig.findMany({ orderBy: { niveau: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  return NextResponse.json({ roles, levels, mastery });
}
