import webpush from "web-push";
import { prisma } from "./prisma";
import { toLocale } from "@/lib/i18n/langues";

/**
 * Services de notification légitimes.
 *
 * `endpoint` est une URL fournie par le client, conservée en base, puis appelée
 * par le serveur. `web-push` ne vérifie ni le schéma ni l'hôte : il appelle ce
 * qu'on lui donne. Sans liste, un compte transformait l'application en sonde —
 * et, comme rien ne plafonne le nombre d'abonnements, en relais amplificateur
 * dirigé vers la cible de son choix, au départ de nos adresses.
 *
 * La validation TLS reste active côté `web-push`, donc les services internes en
 * clair étaient déjà hors d'atteinte. Ce verrou-ci ferme le reste.
 */
const HOTES_PUSH = [
  "fcm.googleapis.com",              // Chrome, Edge, Brave
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com",             // Safari, iOS
];
const SUFFIXES_PUSH = [
  ".notify.windows.com",            // Windows / WNS
  ".push.apple.com",
  ".googleapis.com",
];

/** Nombre d'appareils par compte. Au-delà, le plus ancien cède la place. */
export const ABONNEMENTS_MAX = 10;

/** Vrai si cette adresse est bien celle d'un service de notification connu. */
export function endpointAcceptable(brut: unknown): brut is string {
  if (typeof brut !== "string" || brut.length > 1024) return false;
  let url: URL;
  try {
    url = new URL(brut);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const hote = url.hostname.toLowerCase();
  return HOTES_PUSH.includes(hote) || SUFFIXES_PUSH.some((s) => hote.endsWith(s));
}


/**
 * Notifications web. Elles servent le seul moment où quelqu'un est vraiment
 * disponible pour payer sa dette : entre deux parties, dans la file d'attente.
 * Sans elles, il faut penser à ouvrir l'application — ce que personne ne fait
 * au milieu d'une soirée de jeu.
 *
 * Les clés VAPID vivent dans l'environnement. Sans elles, tout ce module
 * devient inerte plutôt que de faire échouer l'enregistrement d'une partie.
 */

const PUBLIQUE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVEE = process.env.VAPID_PRIVATE_KEY ?? "";
const CONTACT = process.env.VAPID_SUBJECT ?? "mailto:contact@winorworkout.com";

/** Vrai si les notifications sont configurées sur ce déploiement. */
export function pushConfigure(): boolean {
  return PUBLIQUE.length > 0 && PRIVEE.length > 0;
}

let pret = false;
function preparer(): boolean {
  if (!pushConfigure()) return false;
  if (!pret) {
    webpush.setVapidDetails(CONTACT, PUBLIQUE, PRIVEE);
    pret = true;
  }
  return true;
}

export type Notification = {
  titre: string;
  corps: string;
  /** Où emmener la personne quand elle clique. */
  url?: string;
  /** Regroupe les notifications : une nouvelle remplace la précédente. */
  tag?: string;
};

/**
 * Envoie à tous les appareils d'un compte. Un abonnement refusé (404 ou 410)
 * est un navigateur qui a révoqué l'autorisation : on le supprime plutôt que
 * de le retenter indéfiniment.
 *
 * N'échoue jamais bruyamment : une notification perdue ne doit pas empêcher
 * d'enregistrer une partie.
 */
export async function notifier(userId: string, n: Notification): Promise<number> {
  if (!preparer()) return 0;

  const abonnements = await prisma.pushSubscription.findMany({ where: { userId } });
  if (abonnements.length === 0) return 0;

  /**
   * L'adresse porte la langue du compte.
   *
   * Sans elle, le site la rattrape et la renvoie vers la langue NÉGOCIÉE par
   * le navigateur qui ouvre le lien. Or la notification, elle, est déjà écrite
   * dans la langue du compte : on annoncerait donc une chose en japonais pour
   * ouvrir un écran en anglais. La lecture ne coûte qu'une colonne, et elle
   * n'a lieu que s'il y a quelqu'un à prévenir.
   */
  const compte = await prisma.user.findUnique({
    where: { id: userId }, select: { langue: true },
  }).catch(() => null);
  const langue = toLocale(compte?.langue);

  const charge = JSON.stringify({
    titre: n.titre,
    corps: n.corps,
    url: n.url ?? `/${langue}/dashboard`,
    tag: n.tag ?? "wow",
  });

  let envoyees = 0;
  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          charge,
        );
        envoyees++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription
            .delete({ where: { endpoint: a.endpoint } })
            .catch(() => {});
        }
      }
    }),
  );
  return envoyees;
}
