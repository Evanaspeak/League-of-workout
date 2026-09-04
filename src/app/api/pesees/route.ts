import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estJourValide, jourLocal } from "@/lib/serie";

/**
 * Les pesées d'un compte (réponse 021 : « oui, à la fréquence qu'il veut »).
 *
 * Des LIGNES et jamais un total : une courbe EST la suite des lignes, et rien
 * ici ne peut diverger de ce qui le produit. C'est la règle de tout ce que ce
 * projet déduit.
 *
 * Le poids voyage en GRAMMES, et le champ le dit. `User.poids` est en kilos
 * entiers ; deux unités sous un même mot est le malentendu qui a coûté une
 * soirée sur « activité », et quelqu'un qui se pèse à 78,4 kg doit pouvoir
 * l'écrire.
 */

/**
 * Les bornes du plausible, en grammes.
 *
 * Larges à dessein : il s'agit d'attraper l'impossible, pas de discuter un
 * corps. Vingt kilos couvre un enfant, cinq cents un record du monde. Sans
 * borne, une frappe de trop poserait un point qui écraserait toute l'échelle
 * du graphique, et la courbe deviendrait illisible pour toujours.
 */
const MIN_G = 20_000;
const MAX_G = 500_000;

/** Le plafond de lecture. Une pesée par jour, donc trois ans d'historique. */
const MAX_LIGNES = 1_100;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const pesees = await prisma.pesee.findMany({
    where: { userId: user.id },
    select: { jour: true, grammes: true },
    orderBy: { jour: "asc" },
    take: MAX_LIGNES,
  });
  return NextResponse.json({ pesees });
}

/**
 * Enregistre une pesée, ou remplace celle du jour.
 *
 * `upsert` et non `create` : se peser deux fois dans la journée est courant, et
 * c'est la SECONDE qui compte — la première a été faite avant le petit
 * déjeuner ou après, on ne sait pas. Refuser la seconde obligerait à supprimer
 * la première, ce qui est un geste de plus pour rien ; en écrire deux ferait
 * deux points sur la même abscisse.
 *
 * L'unicité est posée EN BASE, pas seulement ici : deux envois partis en même
 * temps liraient tous deux « rien pour ce jour ».
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  /**
   * Le type se vérifie AVANT la conversion. `Number(null)` vaut zéro et
   * `Number([])` aussi ; or `JSON.stringify(NaN)` rend `null`, donc une valeur
   * que le navigateur n'a pas su écrire arriverait comme un poids de zéro —
   * refusé par les bornes ici, mais pour la mauvaise raison, et le message
   * accuserait la saisie au lieu de la sérialisation.
   */
  const grammes = typeof body?.grammes === "number" ? body.grammes : Number.NaN;
  if (!Number.isFinite(grammes) || grammes < MIN_G || grammes > MAX_G) {
    return NextResponse.json({ error: "Poids invalide" }, { status: 400 });
  }

  /**
   * Le jour vient du navigateur, comme pour un paiement : le jour UTC ferait
   * basculer une pesée de six heures du matin sur la veille selon le fuseau.
   * `estJourValide` et non le motif seul — « 2026-02-30 » a la bonne FORME et
   * n'existe pas, et il resterait en base pour toujours sur une date qu'aucun
   * calendrier ne contient.
   */
  const jour = estJourValide(body?.jour) ? (body.jour as string) : jourLocal();

  /**
   * Une pesée datée du FUTUR n'est pas une pesée.
   *
   * Elle décalerait la courbe et fausserait le rappel hebdomadaire, qui
   * regarde la dernière en date. Le contrôle porte sur le jour local rendu par
   * le serveur, ce qui laisse passer un décalage de quelques heures selon le
   * fuseau — c'est voulu : refuser plus serrément refuserait des pesées
   * parfaitement légitimes faites à l'autre bout du monde.
   */
  if (jour > jourLocal()) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  await prisma.pesee.upsert({
    where: { userId_jour: { userId: user.id, jour } },
    create: { userId: user.id, jour, grammes: Math.round(grammes) },
    update: { grammes: Math.round(grammes) },
  });

  const pesees = await prisma.pesee.findMany({
    where: { userId: user.id },
    select: { jour: true, grammes: true },
    orderBy: { jour: "asc" },
    take: MAX_LIGNES,
  });
  return NextResponse.json({ pesees });
}
