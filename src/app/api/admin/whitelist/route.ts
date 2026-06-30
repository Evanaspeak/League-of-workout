import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "evantocquet@gmail.com";
const CONFIG_KEY = "betaWhitelistEmails";

async function getList(): Promise<string[]> {
  const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
  return row ? JSON.parse(row.value) : [];
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  return NextResponse.json({ emails: await getList() });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { email } = await req.json();
  const clean = String(email ?? "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) return NextResponse.json({ error: "Email invalide" }, { status: 400 });

  const list = await getList();
  if (!list.includes(clean)) {
    list.push(clean);
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: JSON.stringify(list) },
      update: { value: JSON.stringify(list) },
    });
  }
  return NextResponse.json({ ok: true, emails: list });
}

export async function DELETE(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { email } = await req.json();
  const clean = String(email ?? "").trim().toLowerCase();
  const list = (await getList()).filter(e => e !== clean);
  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: JSON.stringify(list) },
    update: { value: JSON.stringify(list) },
  });
  return NextResponse.json({ ok: true, emails: list });
}
