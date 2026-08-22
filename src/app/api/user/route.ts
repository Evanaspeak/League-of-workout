import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDefaults } from "@/lib/seed-defaults";
import { getCurrentUser } from "@/lib/auth-helpers";
import { comptePublic } from "@/lib/compte";
import { estAdmin } from "@/lib/admin";
import { pseudoDejaPris, validerPseudo } from "@/lib/identite";
import { REGIONS_RIOT, validerPuuid, validerRiotId } from "@/lib/riot-champs";

export async function GET() {
  await seedDefaults();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  // Le navigateur ne connaît pas la liste des administrateurs : c'est le
  // serveur qui tranche, et le client se contente d'afficher ou non le lien.
  return NextResponse.json({ ...comptePublic(user), estAdmin: estAdmin(user.email) });
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

  // Met à jour l'objectif si fourni. La valeur était reprise par un `Number()`
  // nu : une saisie non numérique donnait NaN, que Prisma refuse d'écrire, et
  // la requête tombait en erreur serveur au lieu de dire ce qui n'allait pas.
  // Le plafond, lui, garde l'objectif dans un ordre de grandeur qu'un corps
  // humain peut atteindre.
  if (body.objectifTotalPompes !== undefined) {
    const objectif = Math.round(Number(body.objectifTotalPompes));
    if (!Number.isFinite(objectif) || objectif < 1 || objectif > 10_000_000) {
      return NextResponse.json({ error: "Objectif invalide" }, { status: 400 });
    }
    await prisma.goal.upsert({
      where: { userId: user.id },
      update: { objectifTotalPompes: objectif },
      create: { userId: user.id, objectifTotalPompes: objectif },
    });
  }

  return NextResponse.json(updated);
}
