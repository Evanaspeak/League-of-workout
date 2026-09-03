import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * Corriger la date de plusieurs parties d'un coup.
 *
 * Un défaut corrigé depuis faisait perdre sa date à une partie ajoutée à la
 * main dans le passé : elle se datait de l'instant de la saisie. Les
 * statistiques par période s'en trouvent fausses sur toutes les parties
 * rattrapées, et les reprendre une par une n'est pas un travail qu'on demande
 * à quelqu'un.
 *
 * Deux gestes, et un seul à la fois :
 *   - `decalageMinutes` déplace les parties choisies en gardant leurs écarts.
 *     C'est celui qui sert quand une soirée entière s'est datée du lendemain.
 *   - `date` les pose toutes au même instant. Plus brutal, utile quand on ne
 *     sait plus que le jour.
 */

/** Assez pour une soirée entière, pas assez pour réécrire tout l'historique par mégarde. */
const MAX_PARTIES = 200;

/** Un an dans chaque sens. Au-delà, ce n'est plus une correction. */
const DECALAGE_MAX_MIN = 365 * 24 * 60;

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }
  const { ids, decalageMinutes, date } = (body ?? {}) as {
    ids?: unknown; decalageMinutes?: unknown; date?: unknown;
  };

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === "string" && i)) {
    return NextResponse.json({ error: "Aucune partie choisie" }, { status: 400 });
  }
  if (ids.length > MAX_PARTIES) {
    return NextResponse.json({ error: "Trop de parties d'un coup" }, { status: 400 });
  }

  const veutDecaler = decalageMinutes !== undefined;
  const veutPoser = date !== undefined;
  // Les deux gestes ensemble n'auraient pas de sens, et l'ordre déciderait du
  // résultat : on refuse plutôt que de choisir à la place de la personne.
  if (veutDecaler === veutPoser) {
    return NextResponse.json({ error: "Choisissez un décalage ou une date" }, { status: 400 });
  }

  let poserA: Date | null = null;
  let minutes = 0;
  if (veutPoser) {
    poserA = new Date(String(date));
    if (Number.isNaN(poserA.getTime())) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }
  } else {
    minutes = Number(decalageMinutes);
    if (!Number.isFinite(minutes) || Math.abs(minutes) > DECALAGE_MAX_MIN || minutes === 0) {
      return NextResponse.json({ error: "Décalage invalide" }, { status: 400 });
    }
  }

  // La sélection est refiltrée sur le compte : une liste d'identifiants vient
  // du navigateur, et rien n'empêche d'y glisser ceux de quelqu'un d'autre.
  const parties = await prisma.game.findMany({
    where: { id: { in: ids as string[] }, userId: user.id },
    select: { id: true, date: true },
  });
  if (parties.length === 0) {
    return NextResponse.json({ error: "Aucune partie choisie" }, { status: 400 });
  }

  /**
   * Une par une, sans transaction : le pilote HTTP de Neon les refuse, et
   * c'est celui de la production. Voir `src/transactionsInterdites.test.ts`.
   *
   * Ce qu'on perd est réel et supportable ici : une panne à mi-parcours
   * laisserait une partie des dates corrigées. C'est un outil de correction en
   * masse, relançable, et son résultat se relit dans l'historique — à la
   * différence d'un paiement, dont la perte ne se voit nulle part.
   *
   * Le nombre rendu est celui des dates RÉELLEMENT posées, pas celui des
   * parties choisies : annoncer soixante corrections quand douze ont abouti
   * serait pire que d'échouer franchement.
   */
  let corrigees = 0;
  for (const p of parties) {
    // `updateMany` et non `update` : le compte revient dans le `where`. La
    // liste est déjà filtrée par la lecture au-dessus, mais une écriture qui
    // porte elle-même son filtre est une garantie de plus, et c'est ce que le
    // garde structurel attend de chaque requête.
    const { count } = await prisma.game.updateMany({
      where: { id: p.id, userId: user.id },
      data: { date: poserA ?? new Date(p.date.getTime() + minutes * 60_000) },
    });
    corrigees += count;
  }

  return NextResponse.json({ corrigees });
}
