import { NextResponse } from "next/server";
import { textesDiffusion } from "@/lib/i18n/diffusion";
import { prisma } from "@/lib/prisma";
import { chargerRatios } from "@/lib/exercicesConfig";
import { exercicesEnTemps, repartirPoints, toExerciceIds, ventiler } from "@/lib/exercices";
import { etatRetard, longueurSerie } from "@/lib/serie";
import { etiquetteLocale, toLocale } from "@/lib/i18n/langues";

export const dynamic = "force-dynamic";

/**
 * La dette, pour un logiciel de diffusion.
 *
 * OBS ouvre une page dans un navigateur sans cookie ni session : l'adresse
 * elle-même est le laissez-passer. Elle ne donne accès qu'à ce qui est destiné
 * à être montré à un public — un nombre d'exercices dus et une série de jours.
 *
 * Ce qu'elle ne donne PAS, et il faut que ça reste vrai : ni adresse
 * électronique, ni pseudo, ni historique, ni statistiques de parties. Un lien
 * collé dans un logiciel finit par circuler, et personne ne se souvient de ce
 * qu'il ouvre.
 */

/** Longueur minimale d'un jeton acceptable, pour ne pas interroger la base pour rien. */
const LONGUEUR_MIN = 24;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jeton: string }> },
) {
  const { jeton } = await params;
  if (typeof jeton !== "string" || jeton.length < LONGUEUR_MIN) {
    return NextResponse.json({ error: "Lien inconnu" }, { status: 404 });
  }

  await chargerRatios();
  const user = await prisma.user.findUnique({
    where: { jetonObs: jeton },
    select: {
      id: true, dettePointsDus: true, detteDepuis: true, exercices: true,
      // La langue du compte : la page de diffusion n'en a pas dans son adresse,
      // et ses trois mots s'affichaient en français devant le public d'un
      // stream. C'est la seule façon de la lui donner.
      langue: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Lien inconnu" }, { status: 404 });

  const exercices = exercicesEnTemps(toExerciceIds(user.exercices));
  const points = exercices.length > 0 ? Math.max(0, user.dettePointsDus) : 0;
  const paiements = await prisma.paiement.findMany({
    where: { userId: user.id },
    select: { jour: true },
    orderBy: { jour: "desc" },
    take: 400,
  });

  const retard = etatRetard(user.detteDepuis, user.dettePointsDus);
  return NextResponse.json({
    lignes: ventiler(repartirPoints(points, exercices), null, etiquetteLocale(toLocale(user.langue))).map((l) => l.valeur),
    points,
    serie: longueurSerie(paiements.map((p) => p.jour)),
    enRetard: retard.enRetard,
    /**
     * Les MOTS, pas la langue.
     *
     * Rendre `langue` ferait sortir une donnée du compte sur une adresse
     * publique, et la politique de confidentialité promet que ce lien ne
     * révèle ni le nom ni les parties. Les libellés, eux, allaient de toute
     * façon s'afficher à l'écran : les traduire ici n'ajoute rien à ce qui est
     * déjà visible.
     */
    textes: textesDiffusion(user.langue),
  });
}
