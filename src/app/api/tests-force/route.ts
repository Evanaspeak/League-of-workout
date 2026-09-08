import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * L'histoire du test de force (ligne 152 du plan).
 *
 * `User.pompesMax` ne garde que la valeur COURANTE : il n'y avait littéralement
 * aucune histoire à tracer, et c'est ce qui bloquait la ligne. Le champ reste —
 * c'est lui qui fixe le niveau, donc le multiplicateur — et `TestForce` est
 * l'HISTOIRE, exactement comme `Pesee` l'est du poids.
 *
 * Des LIGNES et jamais un total : une courbe EST la suite des lignes, et rien
 * ici ne peut diverger de ce qui la produit.
 *
 * En LECTURE seule, et c'est délibéré. L'écriture vit à l'endroit qui pose déjà
 * `pompesMax`, dans `PUT /api/settings` : deux chemins d'écriture pour un seul
 * geste feraient exactement ce que ce journal reproche partout — une valeur
 * courante et une histoire qui divergent au premier oubli.
 */

/**
 * Le plafond de lecture.
 *
 * Un test par jour au maximum, et la consigne est d'en refaire un par mois :
 * mille cent lignes couvrent trois ans de quelqu'un qui en referait un chaque
 * jour, donc bien davantage en pratique. La borne existe pour qu'une réponse
 * ne grandisse pas indéfiniment, pas pour arbitrer un rythme.
 */
const MAX_LIGNES = 1_100;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const tests = await prisma.testForce.findMany({
    where: { userId: user.id },
    select: { jour: true, pompes: true },
    orderBy: { jour: "asc" },
    take: MAX_LIGNES,
  });
  return NextResponse.json({ tests });
}
