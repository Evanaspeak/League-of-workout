import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { envoyerBilanHebdo } from "@/lib/email";
import { textesBilan } from "@/lib/i18n/courriels";
import { bilanHebdo, bilanDu, vautUnBilan, JOURS_BILAN } from "@/lib/bilanHebdo";
import { heureLocale } from "@/lib/fuseau";
import { DEBUT_MATIN, dansLaFenetreDuMatin } from "@/lib/fenetreEnvoi";
import { toLocale } from "@/lib/i18n/langues";

/**
 * Le bilan hebdomadaire, par courriel.
 *
 * L'application ne sait dire que le présent : ce qu'on doit, là, maintenant.
 * Elle ne dit jamais ce qu'on a fait. Sept jours mis bout à bout racontent
 * autre chose, et c'est la seule chose qu'on ait envie de relire.
 *
 * Appelée toutes les heures, comme les notifications, et pour la même raison :
 * neuf heures du matin n'existent pas au même moment pour tout le monde. Un
 * compte sans fuseau connu n'est jamais servi.
 *
 * Rien ne part sur une semaine vide. Un courriel qui dit zéro est celui qu'on
 * se désabonne en l'ouvrant — et l'absence est déjà traitée par la relance.
 */

/** Heure locale d'envoi. La même que les notifications, volontairement. */
/**
 * L'heure locale à laquelle la fenêtre du lundi matin s'ouvre.
 *
 * Le bilan partait à neuf heures PILE, ce qui suppose un déclencheur qui passe
 * toutes les heures. Il ne le fait pas : trente exécutions en huit jours au
 * lieu de cent quatre-vingt-douze, jamais à l'heure voulue. Le bilan
 * hebdomadaire n'est donc jamais parti, et la route répondait 200 à chaque
 * passage — zéro envoi est le résultat normal quand on regarde à la mauvaise
 * heure, donc rien ne pouvait le dire.
 *
 * La fenêtre couvre la matinée. `bilanLe` empêche déjà d'envoyer deux fois,
 * et elle se compte en jours : il n'y a pas de marque à ajouter ici.
 */
export const HEURE_BILAN = DEBUT_MATIN;

/** Jour d'envoi : lundi, quand la semaine passée vient de se refermer. */
export const JOUR_BILAN = 1;

function autorise(req: Request): boolean {
  const attendu = process.env.RAPPEL_SECRET;
  // Sans secret configuré, la route ne fait rien plutôt que de s'ouvrir.
  if (!attendu) return false;
  return req.headers.get("x-rappel-secret") === attendu;
}

export async function POST(req: Request) {
  if (!autorise(req)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const maintenant = new Date();
  const depuis = new Date(maintenant.getTime() - JOURS_BILAN * 24 * 3600_000);

  const comptes = await prisma.user.findMany({
    // Sans adresse, il n'y a rien à envoyer : les comptes « pseudo + code »
    // n'en ont pas.
    where: { email: { not: null }, fuseau: { not: null }, bilanActif: true },
    select: {
      id: true, email: true, pseudo: true, langue: true, fuseau: true,
      bilanLe: true, dettePointsDus: true,
      games: {
        where: { createdAt: { gte: depuis } },
        select: { createdAt: true, result: true, pompesCalculees: true },
      },
      paiements: {
        where: { createdAt: { gte: depuis } },
        select: { createdAt: true, points: true, jour: true },
      },
    },
  });

  let envoyes = 0;
  for (const u of comptes) {
    if (!dansLaFenetreDuMatin(heureLocale(maintenant, u.fuseau))) continue;
    // Le jour de la semaine se lit dans le fuseau de la personne : à neuf
    // heures à Tokyo, il est encore dimanche à Paris.
    const jour = new Intl.DateTimeFormat("en-US", { timeZone: u.fuseau!, weekday: "short" })
      .format(maintenant);
    if (jour !== "Mon") continue;
    if (!bilanDu(u.bilanLe, maintenant)) continue;

    const bilan = bilanHebdo(u.games, u.paiements, maintenant);
    if (!vautUnBilan(bilan)) continue;

    let parti = false;
    try {
      parti = await envoyerBilanHebdo(
        u.email!, u.pseudo, textesBilan(u.langue), bilan, u.dettePointsDus > 0,
        toLocale(u.langue),
      );
    } catch {
      // Une adresse morte ne doit pas arrêter la boucle : c'est un passage sur
      // tous les comptes, et le premier rejet les priverait tous du leur.
    }
    // La date se pose dans tous les cas : sans elle, un envoi qui échoue
    // serait retenté à chaque heure de la journée.
    await prisma.user.update({ where: { id: u.id }, data: { bilanLe: maintenant } })
      .catch(() => {});
    if (parti) envoyes += 1;
  }

  return NextResponse.json({ examines: comptes.length, envoyes });
}
