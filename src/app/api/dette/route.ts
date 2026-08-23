import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  dureeEffort, exercicesEnTemps, repartirPoints, secondesParPoint, toExerciceIds,
} from "@/lib/exercices";
import { chargerRatios } from "@/lib/exercicesConfig";
import { jourLocal } from "@/lib/serie";

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
  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée renvoyée serait celle des valeurs d'origine.
  await chargerRatios();
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
  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée renvoyée serait celle des valeurs d'origine.
  await chargerRatios();
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

  const paye = Math.max(0, dus - restant);

  /**
   * Le paiement laisse une trace, et la date de début de dette se met à jour.
   *
   * Le compteur ne dit que l'état présent : sans historique, une série de
   * jours consécutifs ne se calcule pas, et « en retard depuis trois jours »
   * non plus. Ces deux-là ne sont pas rattrapables après coup.
   *
   * Le jour vient du navigateur : le jour UTC ferait basculer la série d'un
   * jour sur l'autre selon le fuseau de la personne. À défaut, celui du
   * serveur.
   */
  const jour = typeof body?.jour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.jour)
    ? body.jour
    : jourLocal();

  /**
   * Jeton d'un paiement rejoué depuis la file hors ligne.
   *
   * Un téléphone qui retrouve le réseau réessaie tant qu'il n'a pas reçu de
   * réponse — et une réponse perdue en chemin est indiscernable d'une requête
   * jamais arrivée. Sans jeton, ce cas-là paie deux fois la même séance, et
   * c'est le cas normal dans un tunnel.
   *
   * Le contrôle se fait avant la transaction pour la réponse courante, et
   * l'unicité en base la garantit pour de bon : deux renvois partis en même
   * temps passeraient tous deux ce test.
   */
  const jeton = typeof body?.jeton === "string" && body.jeton.length > 0
    ? body.jeton.slice(0, 64)
    : null;
  if (jeton) {
    const deja = await prisma.paiement.findUnique({
      where: { jeton },
      select: { userId: true },
    });
    // Le jeton d'un autre compte n'est pas une raison de refuser : il ne dit
    // rien de celui-ci. C'est le sien, et lui seul, qui vaut « déjà payé ».
    if (deja?.userId === user.id) return NextResponse.json(reponse(user));
  }

  let maj;
  try {
    maj = await prisma.$transaction(async (tx) => {
      if (paye > 0) {
        await tx.paiement.create({ data: { userId: user.id, points: paye, jour, jeton } });
      }
      return tx.user.update({
        where: { id: user.id },
        data: {
          dettePointsDus: restant,
          // Une dette éteinte n'a plus de date de début ; une dette entamée
          // garde la sienne, sinon un paiement partiel remettrait le compteur de
          // retard à zéro sans que rien n'ait été soldé.
          ...(restant === 0 ? { detteDepuis: null } : {}),
        },
        select: { dettePointsDus: true, rappelSeuilSec: true, exercices: true },
      });
    });
  } catch (e) {
    // Deux renvois partis en même temps passent tous les deux le contrôle
    // ci-dessus : c'est l'unicité en base qui tranche, et le perdant a déjà
    // obtenu ce qu'il demandait. Une erreur ici ferait réessayer la file
    // indéfiniment sur un paiement pourtant enregistré.
    if (jeton && (e as { code?: string })?.code === "P2002") {
      return NextResponse.json(reponse(user));
    }
    throw e;
  }
  return NextResponse.json(reponse(maj));
}

/**
 * Fixe directement la valeur du compteur, en secondes d'effort. Sert à tester
 * le rappel sans devoir enregistrer des parties jusqu'à franchir le seuil.
 */
export async function PUT(req: Request) {
  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée renvoyée serait celle des valeurs d'origine.
  await chargerRatios();
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
