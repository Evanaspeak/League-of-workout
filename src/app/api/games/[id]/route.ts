import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retirerDeLaDette } from "@/lib/dette";
import { getCurrentUser } from "@/lib/auth-helpers";
import { parseRepartition, pointsEnTemps } from "@/lib/exercices";
import { analyserDatePartie } from "@/lib/dates";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "Date manquante" }, { status: 400 });
  // Corriger la date d'une partie ne doit pas permettre de la déplacer dans le
  // futur : la borne vaut ici comme à la création.
  const analyse = analyserDatePartie(body.date);
  if (!analyse.ok) return NextResponse.json({ error: analyse.erreur }, { status: 400 });
  const result = await prisma.game.updateMany({
    where: { id, userId: user.id },
    data: { date: analyse.date },
  });
  if (result.count === 0) return NextResponse.json({ error: "Game introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // On relit la partie avant de la supprimer : c'est elle qui dit combien de
  // temps d'effort elle avait ajouté au compteur en attente.
  const game = await prisma.game.findFirst({
    where: { id, userId: user.id },
    select: { exercice: true, repartition: true, pompesCalculees: true },
  });
  if (!game) return NextResponse.json({ error: "Game introuvable" }, { status: 404 });

  const result = await prisma.game.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Game introuvable" }, { status: 404 });
  }

  // Une saisie erronée ne doit pas laisser sa dette derrière elle : on retire
  // du compteur exactement ce que cette partie y avait mis. Seule la part en
  // temps compte — les pompes n'y étaient jamais entrées.
  const aRetirer = pointsEnTemps(
    parseRepartition(game.repartition, game.exercice, game.pompesCalculees),
  );
  let dettePointsDus = null;
  if (aRetirer > 0) {
    try {
      // Le retrait est atomique : lire puis écrire une valeur absolue perdait
      // une partie enregistrée entre les deux. Voir `src/lib/dette.ts`.
      dettePointsDus = await retirerDeLaDette(prisma, user.id, aRetirer);
    } catch { /* la partie est supprimée : on ne fait pas échouer pour autant */ }
  }

  return NextResponse.json({ ok: true, dettePointsDus });
}
