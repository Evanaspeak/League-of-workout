import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estJourValide, jourLocal } from "@/lib/serie";
import {
  classer, debutFenetre, ecartAuPremier, JOURS_CLASSEMENT, longueurFenetre,
} from "@/lib/classement";

/**
 * Le classement entre amis, sur le volume payé de la semaine.
 *
 * Ce qui sort d'ici est choisi colonne par colonne, pour la raison écrite dans
 * `/api/amis` : une amitié donne accès à un pseudo et à un volume d'effort,
 * pas à un compte. `include: { demandeur: true }` publierait l'adresse
 * électronique et le jeton de diffusion de quelqu'un d'autre.
 *
 * **Ce que ce tableau publie, et à qui.** Un pseudo, des points payés sur sept
 * jours, et un état de retard — aux seuls comptes avec lesquels l'amitié a été
 * acceptée des DEUX côtés. Il n'y a pas d'autre chemin : rien ici ne se
 * cherche, et un inconnu n'a aucune ligne à lire. La politique de
 * confidentialité le dit, parce que c'est un renseignement sur quelqu'un
 * d'autre que celui qui le lit.
 *
 * Ce qu'il ne fait PAS encore : permettre d'y participer sans y figurer. C'est
 * la réponse 129, elle est ordonnée plus loin dans le plan, et jusque-là la
 * seule façon de sortir d'un classement est de retirer l'ami.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  /**
   * Le jour vient du navigateur : c'est le sien qui compte, comme pour la
   * série. Et c'est le MIEN qui borne la fenêtre de tout le monde — un
   * classement dont chacun mesurerait sa propre semaine ne comparerait rien.
   */
  const demande = new URL(req.url).searchParams.get("jour");
  const aujourdhui = estJourValide(demande) ? demande : jourLocal();
  const debut = debutFenetre(aujourdhui);

  const liens = await prisma.amitie.findMany({
    where: {
      etat: "acceptee",
      OR: [{ demandeurId: user.id }, { receveurId: user.id }],
    },
    select: { demandeurId: true, receveurId: true },
  });

  /**
   * Soi-même est toujours dans la liste, même sans un seul ami.
   *
   * Un classement où l'on ne figure pas n'est pas son classement, et un compte
   * neuf verrait un tableau vide là où il devrait au moins se voir à zéro.
   */
  const ids = [user.id, ...liens.map((l) => (l.demandeurId === user.id ? l.receveurId : l.demandeurId))];

  const [comptes, sommes] = await Promise.all([
    // Les identifiants viennent de la requête filtrée juste au-dessus : ce
    // sont les amis acceptés du demandeur, et personne d'autre.
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, pseudo: true, detteDepuis: true, dettePointsDus: true },
    }),
    prisma.paiement.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, jour: { gte: debut, lte: aujourdhui } },
      _sum: { points: true },
    }),
  ]);

  const points = new Map(sommes.map((s) => [s.userId, s._sum.points ?? 0]));
  const lignes = classer(comptes, points, user.id);

  return NextResponse.json({
    lignes,
    debut,
    jours: longueurFenetre(debut, aujourdhui),
    ecart: ecartAuPremier(lignes),
    fenetre: JOURS_CLASSEMENT,
  });
}
