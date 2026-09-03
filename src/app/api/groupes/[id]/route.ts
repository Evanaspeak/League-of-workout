import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { nouveauCode, successeur } from "@/lib/social";

/**
 * Quitter un groupe, et refaire son code.
 */

/**
 * Refaire le code. Propriétaire seulement.
 *
 * C'est la seule façon de révoquer un code déjà partagé — dans un salon
 * Discord, dans une conversation, à voix haute. Sans ce bouton, un groupe dont
 * le code a fuité n'a aucune sortie : il faudrait le refaire entièrement et
 * réinviter tout le monde.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const membre = await prisma.membreGroupe.findFirst({
    where: { groupeId: id, userId: user.id, role: "proprietaire" },
    select: { id: true },
  });
  if (!membre) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  const code = nouveauCode();
  await prisma.groupe.update({ where: { id }, data: { code } });
  return NextResponse.json({ code });
}

/**
 * Partir.
 *
 * Trois choses peuvent en découler, et l'ORDRE est la seule protection : le
 * pilote de production ne connaît pas les transactions.
 *
 *  1. **La reprise d'abord.** Un groupe sans propriétaire ne peut plus refaire
 *     son code : c'est une porte qu'on ne peut plus fermer, et rien ne la
 *     répare. Le plus ancien membre restant hérite AVANT que la ligne du
 *     partant ne s'en aille. Une panne entre les deux laisse deux
 *     propriétaires — sans conséquence, et le geste refait règle la chose.
 *  2. Le départ.
 *  3. **Le groupe part avec son dernier membre.** Un groupe vide n'est
 *     rejoignable par personne — le code ne circule plus — et resterait là
 *     pour toujours.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const membres = await prisma.membreGroupe.findMany({
    where: { groupeId: id },
    select: { id: true, userId: true, role: true, createdAt: true },
  });
  const mien = membres.find((m) => m.userId === user.id);
  if (!mien) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  const heritier = successeur(membres, user.id);

  if (mien.role === "proprietaire" && heritier) {
    await prisma.membreGroupe.update({
      where: { id: heritier.id },
      data: { role: "proprietaire" },
    });
  }

  await prisma.membreGroupe.deleteMany({ where: { id: mien.id, userId: user.id } });

  if (!heritier) {
    await prisma.groupe.delete({ where: { id } });
    return NextResponse.json({ parti: true, supprime: true });
  }
  return NextResponse.json({ parti: true, supprime: false });
}
