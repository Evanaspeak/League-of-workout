import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { dureeEffort, repartirPoints, toExerciceIds } from "@/lib/exercices";

/**
 * Dette accumulée et pas encore faite. Elle monte à chaque partie enregistrée,
 * et l'utilisateur la fait retomber en allant s'entraîner.
 */
function reponse(user: {
  dettePointsDus: number;
  rappelSeuilSec: number;
  exercices: string[];
}) {
  const exercices = toExerciceIds(user.exercices);
  const points = Math.max(0, user.dettePointsDus);
  return {
    points,
    exercices,
    /** Ce qu'il y a à faire, exercice par exercice. */
    repartition: repartirPoints(points, exercices),
    /** Temps de travail que ça représente, en secondes. */
    dureeSec: Math.round(dureeEffort(points, exercices)),
    /** Seuil de déclenchement du rappel, en secondes d'effort. 0 = désactivé. */
    seuilSec: Math.max(0, user.rappelSeuilSec),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json(reponse(user));
}

/**
 * Acquitte tout ou partie de la dette.
 *  - `{ tout: true }`      → remise à zéro (l'utilisateur a tout fait)
 *  - `{ secondes: 120 }`   → paiement partiel, converti en points au prorata
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const exercices = toExerciceIds(user.exercices);
  const dus = Math.max(0, user.dettePointsDus);

  let restant = 0;
  if (!body?.tout) {
    const secondesFaites = Math.max(0, Math.round(Number(body?.secondes) || 0));
    const totalSec = dureeEffort(dus, exercices);
    // Un arrêt en cours de route ne paie que le temps réellement effectué.
    const partPayee = totalSec > 0 ? Math.min(1, secondesFaites / totalSec) : 1;
    restant = Math.max(0, dus - Math.round(dus * partPayee));
  }

  const maj = await prisma.user.update({
    where: { id: user.id },
    data: { dettePointsDus: restant },
    select: { dettePointsDus: true, rappelSeuilSec: true, exercices: true },
  });
  return NextResponse.json(reponse(maj));
}
