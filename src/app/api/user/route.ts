import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDefaults } from "@/lib/seed-defaults";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estAdmin } from "@/lib/admin";
import { pseudoDejaPris, validerPseudo } from "@/lib/identite";
import { REGIONS_RIOT, validerPuuid, validerRiotId } from "@/lib/riot-champs";

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

  // Chaque champ est validé ici comme il l'est à l'inscription. Cette route
  // ne vérifiait que le type — et pas même celui du PUUID, qui partait ensuite
  // tel quel dans l'URL appelée chez Riot avec la clé du serveur.
  const data: {
    pseudo?: string; riotId?: string; riotRegion?: string; riotPuuid?: string;
  } = {};

  if (body.pseudo !== undefined) {
    const verdict = validerPseudo(body.pseudo);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.erreur }, { status: verdict.statut });
    }
    if (await pseudoDejaPris(verdict.valeur, user.id)) {
      return NextResponse.json(
        { error: "Ce pseudo est déjà pris. Choisis-en un autre." },
        { status: 409 },
      );
    }
    data.pseudo = verdict.valeur;
  }

  if (body.riotId !== undefined) {
    const riotId = validerRiotId(body.riotId);
    if (riotId === null) {
      return NextResponse.json({ error: "Riot ID invalide" }, { status: 400 });
    }
    data.riotId = riotId;
  }

  if (body.riotRegion !== undefined) {
    if (typeof body.riotRegion !== "string" || !REGIONS_RIOT.includes(body.riotRegion)) {
      return NextResponse.json({ error: "Région inconnue" }, { status: 400 });
    }
    data.riotRegion = body.riotRegion;
  }

  if (body.riotPuuid !== undefined && body.riotPuuid !== null && body.riotPuuid !== "") {
    const puuid = validerPuuid(body.riotPuuid);
    if (puuid === null) {
      return NextResponse.json({ error: "PUUID invalide" }, { status: 400 });
    }
    data.riotPuuid = puuid;
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });

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
