import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifier } from "@/lib/push";
import { textesNotification } from "@/lib/i18n/notifications";
import { heureLocale } from "@/lib/fuseau";
import { relancer } from "@/lib/relance";
import { chargerRatios } from "@/lib/exercicesConfig";
import { dureeEffort, exercicesEnTemps, formaterDuree, toExerciceIds } from "@/lib/exercices";

/**
 * Les envois programmés : ce que l'application dit d'elle-même, sans que
 * personne ait cliqué.
 *
 * Deux choses, aujourd'hui.
 *
 * Le rappel du matin. Une soirée qui finit à deux heures laisse une dette que
 * personne ne paie avant d'aller dormir, et le rappel de seuil est déjà parti
 * la veille au milieu d'une partie. Celui-ci arrive le lendemain, à une heure
 * où on peut réellement faire quelque chose.
 *
 * La relance après deux semaines sans une partie. Une fois, et une seule :
 * une application qui redit tous les jours « tu nous manques » se fait
 * couper, et elle l'a cherché.
 *
 * Appelé toutes les heures depuis GitHub Actions : le service ne sait pas
 * quelle heure il est chez chacun, donc il regarde à chaque passage qui, à
 * cet instant, est au matin chez lui. Un compte sans fuseau connu n'est
 * jamais notifié — envoyer « bonjour » à trois heures du matin est pire que
 * ne rien envoyer.
 */

/** L'heure locale à laquelle le rappel part. */
export const HEURE_RAPPEL = 9;

/**
 * En dessous, ça ne vaut pas la peine de réveiller quelqu'un pour ça : une
 * poignée de secondes d'effort se fait sans qu'on ait besoin de le rappeler.
 */
export const MINIMUM_SEC = 120;

function autorise(req: Request): boolean {
  const attendu = process.env.RAPPEL_SECRET;
  // Sans secret configuré, la route ne fait rien plutôt que de s'ouvrir : une
  // variable oubliée ne doit pas transformer un déclencheur en porte ouverte.
  if (!attendu) return false;
  return req.headers.get("x-rappel-secret") === attendu;
}

export async function POST(req: Request) {
  if (!autorise(req)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée annoncée serait celle des valeurs d'origine.
  await chargerRatios();

  const maintenant = new Date();
  const candidats = await prisma.user.findMany({
    where: { dettePointsDus: { gt: 0 }, fuseau: { not: null } },
    select: { id: true, dettePointsDus: true, exercices: true, langue: true, fuseau: true },
  });

  let envoyes = 0;
  for (const u of candidats) {
    if (heureLocale(maintenant, u.fuseau) !== HEURE_RAPPEL) continue;
    // Seule la part comptée en temps s'accumule : le reste s'est fait dans la
    // foulée des parties et n'attend pas.
    const exercices = exercicesEnTemps(toExerciceIds(u.exercices));
    if (exercices.length === 0) continue;
    const sec = Math.round(dureeEffort(u.dettePointsDus, exercices));
    if (sec < MINIMUM_SEC) continue;

    const { titre, corps } = textesNotification(u.langue).matin(formaterDuree(sec));
    // Un envoi raté ne doit pas empêcher les suivants : c'est une boucle sur
    // tous les comptes, et le premier abonnement périmé les arrêterait tous.
    const partis = await notifier(u.id, { titre, corps, tag: "wow-matin" }).catch(() => 0);
    if (partis > 0) envoyes += 1;
  }

  const relances = await relancerLesAbsents(maintenant);
  return NextResponse.json({ examines: candidats.length, envoyes, relances });
}

/**
 * La relance des absents.
 *
 * Elle part à la même heure locale que le rappel du matin, pour la même
 * raison, et elle ne compte pas la dette : quelqu'un qui n'a pas joué depuis
 * deux semaines n'a rien accumulé. Ce qu'on lui dit, c'est le nombre de jours.
 */
async function relancerLesAbsents(maintenant: Date): Promise<number> {
  const comptes = await prisma.user.findMany({
    where: { fuseau: { not: null } },
    select: {
      id: true, langue: true, fuseau: true, relanceLe: true,
      // La date d'ENREGISTREMENT et non celle de la partie : une partie
      // ajoutée à la main se date dans le passé, et l'absence en ressortirait
      // plus longue qu'elle ne l'est.
      games: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  let envoyees = 0;
  for (const u of comptes) {
    if (heureLocale(maintenant, u.fuseau) !== HEURE_RAPPEL) continue;
    const dernierePartie = u.games[0]?.createdAt ?? null;
    if (!relancer({ dernierePartie, derniereRelance: u.relanceLe }, maintenant)) continue;

    const jours = Math.floor(
      (maintenant.getTime() - dernierePartie!.getTime()) / (24 * 3600_000));
    const { titre, corps } = textesNotification(u.langue).relance(jours);
    const partis = await notifier(u.id, { titre, corps, tag: "wow-relance" }).catch(() => 0);
    // La date se pose même si l'envoi n'a atteint personne : sans abonnement,
    // réessayer chaque jour ne changerait rien et referait le tour de la base.
    await prisma.user.update({ where: { id: u.id }, data: { relanceLe: maintenant } })
      .catch(() => {});
    if (partis > 0) envoyees += 1;
  }
  return envoyees;
}
