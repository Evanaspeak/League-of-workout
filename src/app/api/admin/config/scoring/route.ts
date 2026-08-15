import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { estAdmin } from "@/lib/admin";


export async function GET() {
  const me = await getCurrentUser();
  if (!me || !estAdmin(me.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [roles, levels, mastery] = await Promise.all([
    prisma.roleWeight.findMany({ orderBy: { role: "asc" } }),
    prisma.levelConfig.findMany({ orderBy: { niveau: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  return NextResponse.json({ roles, levels, mastery });
}
