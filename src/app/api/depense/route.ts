import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estJourValide, jourLocal } from "@/lib/serie";
import { lireCorps } from "@/lib/corpsRequete";
import { mesuresCompletes, type Mesures } from "@/lib/objectifCalorique";
import { verdictDepense } from "@/lib/depenseJour";

/**
 * La dépense mesurée d'une journée (réponse 040).
 *
 * Calquée sur `/api/pesees`, et pour les mêmes raisons : des LIGNES et jamais
 * un total, une par jour, l'unicité posée EN BASE, et le jour qui vient du
 * NAVIGATEUR — le jour UTC ferait basculer une saisie de six heures du matin
 * sur la veille selon le fuseau.
 */

/** Le plafond de lecture. Une saisie par jour, donc trois ans d'historique. */
const MAX_LIGNES = 1_100;

/** Les mesures du compte, ou `null` si le profil n'est pas complet. */
function mesuresDe(u: {
  formuleCalorique: string | null; poids: number | null;
  taille: number | null; age: number | null; niveauActivite: string | null;
}): Mesures | null {
  const m = {
    formule: u.formuleCalorique, poids: u.poids,
    taille: u.taille, age: u.age, activite: u.niveauActivite,
  };
  return mesuresCompletes(m as Partial<Mesures>) ? (m as unknown as Mesures) : null;
}

async function lignes(userId: string) {
  return prisma.depenseJour.findMany({
    where: { userId },
    select: { jour: true, kcalBrulees: true },
    orderBy: { jour: "asc" },
    take: MAX_LIGNES,
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ depenses: await lignes(user.id) });
}

/**
 * Enregistre la dépense du jour, ou remplace celle qui y était.
 *
 * `upsert` et non `create` : on relève sa montre le soir, et si on la relève
 * deux fois c'est la seconde qui compte — la première a été prise avant la
 * séance ou après, on ne sait pas.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await lireCorps(req);
  if (!body) return NextResponse.json({ error: "Corps illisible" }, { status: 400 });

  /**
   * Le type se vérifie AVANT la conversion. `Number(null)` vaut zéro, et
   * `JSON.stringify(NaN)` rend `null` : une valeur que le navigateur n'a pas su
   * écrire arriverait comme une dépense de zéro, refusée par les bornes mais
   * pour la mauvaise raison, et le message accuserait la saisie.
   */
  const kcal = typeof body.kcalBrulees === "number" ? body.kcalBrulees : Number.NaN;

  /**
   * Le refus DIT ce qu'il attend, et c'est tout le sujet.
   *
   * Une montre affiche les calories ACTIVES et la dépense TOTALE de la
   * journée ; elles diffèrent d'un facteur trois. Une valeur sous le
   * métabolisme de base est presque toujours la première prise pour la
   * seconde — un corps dépense son métabolisme rien qu'en restant couché — et
   * « valeur invalide » enverrait retaper le même chiffre.
   */
  const verdict = verdictDepense(kcal, mesuresDe(user));
  if (verdict === "sous-le-metabolisme") {
    return NextResponse.json({ error: "Dépense de la journée entière attendue" }, { status: 400 });
  }
  if (verdict !== "ok") {
    return NextResponse.json({ error: "Dépense invalide" }, { status: 400 });
  }

  /**
   * `estJourValide` et non le motif seul : « 2026-02-30 » a la bonne FORME et
   * n'existe pas, et il resterait en base pour toujours sur une date qu'aucun
   * calendrier ne contient.
   */
  const propose = typeof body.jour === "string" ? body.jour : null;
  const jour = estJourValide(propose) ? propose : jourLocal();

  /**
   * Une dépense datée du FUTUR n'est pas une mesure. Le contrôle porte sur le
   * jour local du serveur, ce qui laisse passer quelques heures de décalage
   * selon le fuseau — c'est voulu : refuser plus serrément refuserait des
   * saisies parfaitement légitimes faites à l'autre bout du monde.
   */
  if (jour > jourLocal()) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const valeur = Math.round(kcal);
  await prisma.depenseJour.upsert({
    where: { userId_jour: { userId: user.id, jour } },
    create: { userId: user.id, jour, kcalBrulees: valeur },
    update: { kcalBrulees: valeur },
  });

  return NextResponse.json({ depenses: await lignes(user.id) });
}

