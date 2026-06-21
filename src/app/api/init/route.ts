import { NextResponse } from "next/server";
import { seedDefaults } from "@/lib/seed-defaults";

export async function GET() {
  await seedDefaults();
  return NextResponse.json({ ok: true });
}
