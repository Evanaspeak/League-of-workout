import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { MAX_AMIS } from "@/lib/social";

/**
 * Répondre à une amitié : accepter, ou la retirer.
 *
 * Les deux verbes filtrent par compte dans le `where` de l'ÉCRITURE, jamais
 * seulement à la lecture d'avant : une écriture qui porte elle-même son filtre
 * ne dépend pas de ce qui la précède.
 */

/**
 * Accepter. Seul le RECEVEUR peut le faire — c'est ce que le filtre dit.
 *
 * Sans `receveurId` dans le `where`, celui qui a demandé pourrait accepter sa
 * propre demande, et l'amitié n'aurait plus rien d'une amitié : elle
 * s'imposerait.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const amis = await prisma.amitie.count({
    where: { etat: "acceptee", OR: [{ demandeurId: user.id }, { receveurId: user.id }] },
  });
  if (amis >= MAX_AMIS) {
    return NextResponse.json({ error: "Liste d'amis pleine" }, { status: 409 });
  }

  const { count } = await prisma.amitie.updateMany({
    where: { id, receveurId: user.id, etat: "attente" },
    data: { etat: "acceptee", accepteeLe: new Date() },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }
  return NextResponse.json({ etat: "acceptee" });
}

/**
 * Refuser une demande reçue, annuler une demande envoyée, retirer un ami.
 *
 * Un seul verbe pour les trois, parce que c'est une seule chose en base : la
 * ligne s'en va. **Un refus ne se marque pas.** Le garder en trace donnerait à
 * qui insiste le moyen de savoir qu'il a été refusé, et il n'y a personne pour
 * arbitrer ce qui suivrait — l'espace n'est pas modéré, c'est la réponse 127.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const { count } = await prisma.amitie.deleteMany({
    where: { id, OR: [{ demandeurId: user.id }, { receveurId: user.id }] },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }
  return NextResponse.json({ retire: true });
}
