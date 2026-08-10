import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  dureeEffort, exercicesEnTemps, repartirPoints, secondesParPoint, toExerciceIds,
} from "@/lib/exercices";

/**
 * Dette en attente. Seuls les exercices comptés en temps s'y accumulent :
 * des pompes se font tout de suite après la partie, tandis qu'un round de
 * boxe n'a d'intérêt qu'une fois quelques minutes réunies.
 */
function reponse(user: {
  dettePointsDus: number;
  rappelSeuilSec: number;
  exercices: string[];
}) {
  const exercices = exercicesEnTemps(toExerciceIds(user.exercices));
  // Sans exercice au temps sélectionné, il n'y a rien à cumuler.
  const points = exercices.length > 0 ? Math.max(0, user.dettePointsDus) : 0;
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
  const exercices = exercicesEnTemps(toExerciceIds(user.exercices));
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

/**
 * Fixe directement la valeur du compteur, en secondes d'effort. Sert à tester
 * le rappel sans devoir enregistrer des parties jusqu'à franchir le seuil.
 */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const secondes = Number(body?.secondes);
  // Jusqu'à 2 h : au-delà on ne teste plus rien, on casse juste ses données.
  if (!Number.isFinite(secondes) || secondes < 0 || secondes > 7200) {
    return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
  }

  const exercices = exercicesEnTemps(toExerciceIds(user.exercices));
  if (exercices.length === 0) {
    return NextResponse.json({ error: "Aucun exercice au temps sélectionné" }, { status: 400 });
  }

  // Le compteur vit en points d'effort : on convertit la durée demandée avec
  // la même cadence que celle qui sert à l'afficher.
  const parPoint = secondesParPoint(exercices[0]);
  const points = parPoint > 0 ? Math.round(secondes / parPoint) : 0;

  const maj = await prisma.user.update({
    where: { id: user.id },
    data: { dettePointsDus: points },
    select: { dettePointsDus: true, rappelSeuilSec: true, exercices: true },
  });
  return NextResponse.json(reponse(maj));
}
