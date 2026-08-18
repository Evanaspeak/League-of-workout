import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDefaults } from "@/lib/seed-defaults";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estAdmin } from "@/lib/admin";

export async function GET() {
  await seedDefaults();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  // Le hash du mot de passe ne doit jamais quitter le serveur.
  const safeUser: Record<string, unknown> = { ...user };
  delete safeUser.passwordHash;
  // Le navigateur ne connaît pas la liste des administrateurs : c'est le
  // serveur qui tranche, et le client se contente d'afficher ou non le lien.
  safeUser.estAdmin = estAdmin(user.email);
  return NextResponse.json(safeUser);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    // Champ par champ : le profil et le compte Riot vivent désormais dans deux
    // panneaux séparés des réglages. Écrire les trois d'un bloc effaçait le
    // pseudo dès qu'on n'enregistrait que le compte de jeu.
    data: {
      ...(typeof body.pseudo === "string" ? { pseudo: body.pseudo } : {}),
      ...(typeof body.riotId === "string" ? { riotId: body.riotId } : {}),
      ...(typeof body.riotRegion === "string" ? { riotRegion: body.riotRegion } : {}),
      ...(body.riotPuuid ? { riotPuuid: body.riotPuuid } : {}),
    },
  });

  // Met à jour l'objectif si fourni
  if (body.objectifTotalPompes !== undefined) {
    await prisma.goal.upsert({
      where: { userId: user.id },
      update: { objectifTotalPompes: Number(body.objectifTotalPompes) },
      create: { userId: user.id, objectifTotalPompes: Number(body.objectifTotalPompes) },
    });
  }

  return NextResponse.json(updated);
}
