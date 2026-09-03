import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { normaliserCode, MAX_GROUPES, MAX_MEMBRES } from "@/lib/social";

/**
 * Rejoindre un groupe avec son code.
 *
 * C'est la seule porte, et elle ne dit rien de plus qu'il ne faut : un code
 * inconnu et un groupe plein ne se distinguent pas de l'extérieur — sinon on
 * saurait, par la différence des deux réponses, quels codes existent, et
 * essayer des codes au hasard deviendrait un moyen de trouver les groupes.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  const code = normaliserCode(body.code);
  if (!code) return NextResponse.json({ error: "Code invalide" }, { status: 400 });

  const groupe = await prisma.groupe.findUnique({
    where: { code },
    select: { id: true, nom: true, code: true, _count: { select: { membres: true } } },
  });
  if (!groupe) return NextResponse.json({ error: "Aucun groupe pour ce code" }, { status: 404 });

  const miens = await prisma.membreGroupe.count({ where: { userId: user.id } });
  if (miens >= MAX_GROUPES) {
    return NextResponse.json({ error: "Trop de groupes" }, { status: 409 });
  }
  if (groupe._count.membres >= MAX_MEMBRES) {
    return NextResponse.json({ error: "Aucun groupe pour ce code" }, { status: 404 });
  }

  /**
   * Y être déjà n'est pas une erreur.
   *
   * Le code se colle deux fois, on revient sur l'écran, un envoi part en
   * double : dans les trois cas la réponse juste est « tu y es », et non un
   * refus qui laisse croire que le code ne marche pas. C'est la règle du jeton
   * de paiement, appliquée à une appartenance.
   */
  try {
    await prisma.membreGroupe.create({ data: { groupeId: groupe.id, userId: user.id } });
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002") throw e;
    return NextResponse.json({
      id: groupe.id, nom: groupe.nom, code: groupe.code,
      membres: groupe._count.membres, proprietaire: false, deja: true,
    });
  }

  return NextResponse.json({
    id: groupe.id, nom: groupe.nom, code: groupe.code,
    membres: groupe._count.membres + 1, proprietaire: false,
  });
}
