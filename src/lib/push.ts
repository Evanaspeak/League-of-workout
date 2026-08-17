import webpush from "web-push";
import { prisma } from "./prisma";

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

  const charge = JSON.stringify({
    titre: n.titre,
    corps: n.corps,
    url: n.url ?? "/dashboard",
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
