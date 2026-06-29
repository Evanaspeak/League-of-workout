import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CHAMPIONS } from "@/lib/champions";

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: "champions" } });
    if (config) {
      const list = JSON.parse(config.value);
      if (Array.isArray(list) && list.length > 0) return NextResponse.json(list);
    }
  } catch {}
  return NextResponse.json(CHAMPIONS);
}
