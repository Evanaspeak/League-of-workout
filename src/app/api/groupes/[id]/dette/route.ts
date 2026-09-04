import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { composerDetteEquipe, decisionRelais } from "@/lib/detteGroupe";
import { retirerDeLaDette } from "@/lib/dette";
import { estJourValide, jourLocal } from "@/lib/serie";

/**
 * La dette commune d'une équipe, et le relais qui la fait baisser.
 *
 * Réponse 118 : « Cinq personnes, une dette commune, chacun paie ce qu'il
 * peut. Ça sauve celui qui décroche. » Il n'y a pas de second registre — la
 * dette commune est la somme des dettes personnelles, et ce qui est nouveau
 * c'est qu'un effort puisse acquitter celle d'un autre.
 */

/**
 * Retrouve le groupe SI la personne en est membre.
 *
 * Un groupe dont on n'est pas membre rend 404 et non 403 : distinguer les deux
 * apprendrait, identifiant par identifiant, quels groupes existent — c'est la
 * règle déjà posée pour le groupe plein, qui répond comme un code inconnu.
 */
async function membresDuGroupe(groupeId: string, moiId: string) {
  const moi = await prisma.membreGroupe.findFirst({
    where: { groupeId, userId: moiId },
    select: { id: true },
  });
  if (!moi) return null;

  // Lire le pseudo et la dette de ses coéquipiers est tout l'objet d'une dette
  // commune. Le filtrage porte sur l'APPARTENANCE, qui vient d'être vérifiée
  // pour le compte qui demande.
  return prisma.user.findMany({
    where: { groupes: { some: { groupeId } } },
    select: { id: true, pseudo: true, dettePointsDus: true, fantome: true },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const membres = await membresDuGroupe(id, user.id);
  if (!membres) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  return NextResponse.json(composerDetteEquipe(membres, user.id));
}

/**
 * Prendre une part de la dette d'un coéquipier.
 *
 * L'effort est FAIT par celui qui appelle : la trace lui appartient, donc le
 * classement la lui compte, ce qui est juste — c'est lui qui a fait les
 * pompes. Ce qui change de main, c'est de quelle dette elles sont retirées.
 *
 * **Deux écritures, sans transaction, et dans cet ordre-là**, pour la raison
 * déjà écrite dans `/api/dette` : le pilote HTTP de Neon les refuse, et il n'y
 * a donc rien pour rattraper une écriture qui passe et l'autre pas.
 *
 *  - la TRACE d'abord. Si le décompte échoue derrière, l'effort est enregistré
 *    et la dette du coéquipier reste due : il la refait, c'est désagréable et
 *    rattrapable ;
 *  - l'inverse effacerait une dette sans trace, et le renvoi la décompterait
 *    une seconde fois — sur le compte de quelqu'un d'autre, qui n'aurait aucun
 *    moyen de comprendre.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const membres = await membresDuGroupe(id, user.id);
  if (!membres) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });

  const cible = membres.find((m) => m.id === body?.membre) ?? null;
  const decision = decisionRelais(body?.points, cible, user.id);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.erreur }, { status: decision.statut });
  }

  const jour = estJourValide(body?.jour) ? (body.jour as string) : jourLocal();

  /**
   * Le jeton d'unicité vaut ici comme ailleurs.
   *
   * Un relais fait dans le métro repart en file hors ligne, et une réponse
   * perdue en chemin est indiscernable d'une requête jamais arrivée. Sans
   * jeton, ce cas-là acquitte deux fois — et sur la dette d'un TIERS, qui ne
   * saurait pas d'où vient la seconde baisse.
   */
  const jeton = typeof body?.jeton === "string" && body.jeton.length > 0
    ? body.jeton.slice(0, 64)
    : null;
  if (jeton) {
    const deja = await prisma.paiement.findUnique({
      where: { jeton },
      select: { userId: true },
    });
    if (deja?.userId === user.id) {
      const frais = await membresDuGroupe(id, user.id);
      return NextResponse.json(composerDetteEquipe(frais ?? membres, user.id));
    }
  }

  try {
    await prisma.paiement.create({
      data: { userId: user.id, pourUserId: decision.points > 0 ? cible!.id : null, points: decision.points, jour, jeton },
    });
  } catch (e) {
    if (jeton && (e as { code?: string })?.code === "P2002") {
      const frais = await membresDuGroupe(id, user.id);
      return NextResponse.json(composerDetteEquipe(frais ?? membres, user.id));
    }
    throw e;
  }

  await retirerDeLaDette(prisma, cible!.id, decision.points);

  const apres = await membresDuGroupe(id, user.id);
  return NextResponse.json(composerDetteEquipe(apres ?? membres, user.id));
}
