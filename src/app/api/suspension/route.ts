import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isExerciceId, toExerciceIds, type ExerciceId } from "@/lib/exercices";

/**
 * Mettre un exercice de côté, et le reprendre.
 *
 * Une gêne au poignet interdit les pompes pendant deux semaines. Sans ce
 * geste, il ne restait que deux issues : décocher l'exercice dans les réglages
 * — ce qui perd la trace de ce qu'on faisait — ou continuer et aggraver.
 *
 * L'exercice suspendu SORT de la liste active. Tout ce qui répartit la dette
 * lit déjà cette liste : la dette part donc vers les autres exercices sans
 * qu'aucune de ces six lectures ait à changer, et sans qu'on risque d'en
 * oublier une.
 *
 * La série n'est pas concernée : elle compte les jours où la dette a été
 * payée, et payer avec un autre exercice reste payer.
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({
    actifs: toExerciceIds(user.exercices),
    suspendus: (user.exercicesSuspendus ?? []).filter(isExerciceId),
    depuis: user.suspensionDepuis ?? null,
  });
}

/** Suspend un exercice. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }
  const exercice = (body as { exercice?: unknown } | null)?.exercice;
  if (!isExerciceId(exercice)) {
    return NextResponse.json({ error: "Exercice inconnu" }, { status: 400 });
  }

  const actifs = toExerciceIds(user.exercices);
  if (!actifs.includes(exercice)) {
    return NextResponse.json({ error: "Cet exercice n'est pas actif" }, { status: 400 });
  }
  /**
   * Le dernier exercice ne se suspend pas.
   *
   * Sans lui, la dette n'aurait plus aucune façon d'être payée : elle
   * s'accumulerait sans issue, et la seule sortie serait de rouvrir les
   * réglages en comprenant pourquoi. Une gêne totale se règle en arrêtant de
   * jouer, pas en cassant le compteur.
   */
  if (actifs.length === 1) {
    return NextResponse.json(
      { error: "Gardez au moins un exercice : sinon la dette n'a plus aucune façon d'être payée." },
      { status: 400 },
    );
  }

  const restants = actifs.filter((id) => id !== exercice);
  const suspendus = [
    ...new Set([...(user.exercicesSuspendus ?? []).filter(isExerciceId), exercice]),
  ] as ExerciceId[];

  await prisma.user.update({
    where: { id: user.id },
    data: {
      exercices: restants,
      exercicesSuspendus: suspendus,
      // La date de la PREMIÈRE suspension en cours : suspendre un second
      // exercice ne remet pas le compteur à zéro.
      suspensionDepuis: user.suspensionDepuis ?? new Date(),
    },
  });
  return NextResponse.json({ actifs: restants, suspendus });
}

/** Reprend un exercice suspendu. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }
  const exercice = (body as { exercice?: unknown } | null)?.exercice;
  if (!isExerciceId(exercice)) {
    return NextResponse.json({ error: "Exercice inconnu" }, { status: 400 });
  }

  const suspendus = (user.exercicesSuspendus ?? []).filter(isExerciceId).filter((id) => id !== exercice);
  const actifs = toExerciceIds([...toExerciceIds(user.exercices), exercice]);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      exercices: actifs,
      exercicesSuspendus: suspendus,
      // Plus rien de suspendu : la date n'a plus d'objet.
      suspensionDepuis: suspendus.length > 0 ? user.suspensionDepuis : null,
    },
  });
  return NextResponse.json({ actifs, suspendus });
}
