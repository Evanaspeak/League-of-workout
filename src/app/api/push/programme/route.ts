import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifier, pushConfigure } from "@/lib/push";
import { textesNotification } from "@/lib/i18n/notifications";
import { heureLocale, jourDansFuseau } from "@/lib/fuseau";
import { rappelerPesee } from "@/lib/rappelPesee";
import { DEBUT_MATIN, dansLaFenetreDuMatin, dejaEnvoyeAujourdhui } from "@/lib/fenetreEnvoi";
import { relancer } from "@/lib/relance";
import { chargerRatios } from "@/lib/exercicesConfig";
import { dureeAffichee, exercicesEnTemps, formaterDuree, toExerciceIds } from "@/lib/exercices";
import { etiquetteLocale, toLocale } from "@/lib/i18n/langues";

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
 * Appelé depuis GitHub Actions : le service ne sait pas quelle heure il est
 * chez chacun, donc il regarde à chaque passage qui, à cet instant, est au
 * matin chez lui. Un compte sans fuseau connu n'est jamais notifié — envoyer
 * « bonjour » à trois heures du matin est pire que ne rien envoyer.
 *
 * **Une fenêtre, et non une heure.** Le déclencheur était réputé passer toutes
 * les heures ; il ne le fait pas. Relevé sur huit jours : trente exécutions au
 * lieu de cent quatre-vingt-douze, et aucune à sept heures UTC — c'est-à-dire
 * neuf heures en France. Cette route répondait 200 à chaque passage, avec zéro
 * envoi, ce qui est le résultat normal quand on regarde à la mauvaise heure :
 * rien ne pouvait le signaler. La fenêtre couvre maintenant la matinée, et une
 * marque par compte empêche d'envoyer trois fois entre neuf heures et midi.
 */

/**
 * L'heure locale à laquelle la fenêtre du matin s'ouvre.
 *
 * Ce n'est plus l'heure à laquelle le rappel part : il part au premier passage
 * du déclencheur DANS la fenêtre, qui va de neuf heures à midi. Le nom reste
 * pour ce qu'il désigne toujours — le moment où l'on juge décent d'écrire.
 */
export const HEURE_RAPPEL = DEBUT_MATIN;

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
  /**
   * Sans clés VAPID, ce module est inerte : `notifier` rend zéro sans rien
   * tenter. La route continuait quand même — elle parcourait toute la base,
   * posait `rappelLe` et `relanceLe` sur chaque compte, et répondait
   * `{ examines: N, envoyes: 0 }`, c'est-à-dire exactement ce que rend une
   * matinée normale où personne n'a rien à payer.
   *
   * Ce n'est pas qu'une affaire de journal. Les marques sont CONSOMMÉES : une
   * clé posée à dix heures ne rattrape pas le rappel déjà marqué à neuf, et la
   * relance des absents, elle, se rejoue tous les quatre-vingt-dix jours. Le
   * seul message que le produit adresse à quelqu'un qui a cessé de jouer était
   * donc brûlé par un déploiement incapable de l'envoyer, en silence.
   *
   * On s'arrête avant d'écrire quoi que ce soit, et la réponse le dit — c'est
   * la leçon de la sauvegarde muette : une exécution qui saute tout et une
   * exécution qui travaille ne doivent pas rendre la même chose.
   */
  if (!pushConfigure()) {
    return NextResponse.json({ examines: 0, envoyes: 0, relances: 0, pesees: 0, push: "absent" });
  }

  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée annoncée serait celle des valeurs d'origine.
  await chargerRatios();

  const maintenant = new Date();
  const candidats = await prisma.user.findMany({
    where: { dettePointsDus: { gt: 0 }, fuseau: { not: null } },
    select: {
      id: true, dettePointsDus: true, exercices: true, langue: true, fuseau: true,
      rappelLe: true,
    },
  });

  let envoyes = 0;
  for (const u of candidats) {
    if (!dansLaFenetreDuMatin(heureLocale(maintenant, u.fuseau))) continue;
    // Le jour se lit dans le fuseau de la personne : à midi à Tokyo, c'est
    // encore la veille à Paris, et la marque désignerait le mauvais jour.
    const jourDe = (d: Date) => jourDansFuseau(d, u.fuseau);
    if (dejaEnvoyeAujourdhui(u.rappelLe, maintenant, jourDe)) continue;
    // Seule la part comptée en temps s'accumule : le reste s'est fait dans la
    // foulée des parties et n'attend pas.
    const exercices = exercicesEnTemps(toExerciceIds(u.exercices));
    if (exercices.length === 0) continue;
    // La MÊME durée que celle affichée à l'écran : une notification qui
    // annonce un autre nombre que la pastille est un chiffre de plus à ne
    // pas comprendre.
    const sec = Math.round(dureeAffichee(u.dettePointsDus, exercices));
    if (sec < MINIMUM_SEC) continue;

    const { titre, corps } = textesNotification(u.langue).matin(formaterDuree(sec, etiquetteLocale(toLocale(u.langue))));
    // Un envoi raté ne doit pas empêcher les suivants : c'est une boucle sur
    // tous les comptes, et le premier abonnement périmé les arrêterait tous.
    const partis = await notifier(u.id, { titre, corps, tag: "wow-matin" }).catch(() => 0);
    // La marque se pose même si l'envoi n'a atteint personne : sans
    // abonnement, réessayer à dix heures puis à onze ne changerait rien et
    // referait le tour de la base. Même règle que la relance.
    await prisma.user.update({ where: { id: u.id }, data: { rappelLe: maintenant } })
      .catch(() => {});
    if (partis > 0) envoyes += 1;
  }

  const relances = await relancerLesAbsents(maintenant);
  const pesees = await rappelerLesPesees(maintenant);
  return NextResponse.json({
    examines: candidats.length, envoyes, relances, pesees, push: "configuré",
  });
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
    // Même fenêtre que le rappel. Pas besoin d'une marque de plus ici :
    // `relancer` en tient déjà une, et elle se compte en semaines.
    if (!dansLaFenetreDuMatin(heureLocale(maintenant, u.fuseau))) continue;
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

/**
 * Le rappel de pesée hebdomadaire (réponse 022, optionnel).
 *
 * Même fenêtre que les deux autres, et pour la même raison : c'est le matin
 * qu'on se pèse, à jeun, avant que la journée ne fausse le chiffre.
 *
 * La requête est resserrée sur `rappelPeseeActif` — le réglage est éteint par
 * défaut, donc cette boucle ne parcourt que les comptes qui l'ont demandé, et
 * pas toute la base comme les deux précédentes.
 */
async function rappelerLesPesees(maintenant: Date): Promise<number> {
  const comptes = await prisma.user.findMany({
    where: { rappelPeseeActif: true, fuseau: { not: null } },
    select: {
      id: true, langue: true, fuseau: true, rappelPeseeLe: true, createdAt: true,
      pesees: { orderBy: { jour: "desc" }, take: 1, select: { jour: true } },
    },
  });

  let envoyees = 0;
  for (const u of comptes) {
    if (!dansLaFenetreDuMatin(heureLocale(maintenant, u.fuseau))) continue;
    const etat = {
      actif: true,
      dernierePesee: u.pesees[0]?.jour ?? null,
      dernierRappel: u.rappelPeseeLe,
      creeLe: u.createdAt,
    };
    if (!rappelerPesee(etat, maintenant)) continue;

    const { titre, corps } = textesNotification(u.langue).pesee();
    const partis = await notifier(u.id, { titre, corps, tag: "wow-pesee" }).catch(() => 0);
    // La marque se pose même si l'envoi n'a atteint personne, comme pour les
    // deux autres : sans abonnement, réessayer demain matin ne changerait rien
    // et referait le tour de la base.
    await prisma.user.update({ where: { id: u.id }, data: { rappelPeseeLe: maintenant } })
      .catch(() => {});
    if (partis > 0) envoyees += 1;
  }
  return envoyees;
}
