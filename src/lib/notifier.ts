/**
 * Rappel système, par le chemin qui marche là où on est.
 *
 * Sur le site, c'est l'API `Notification` du navigateur, soumise à une
 * autorisation. Dans l'application desktop, celle-ci ne suffit pas : les
 * rappels y passaient par le push web, qui exige un abonnement auprès du
 * service de notification du navigateur — service dont Electron n'a pas les
 * identifiants. L'abonnement échouait, et le bouton « Activer » des réglages ne
 * pouvait rien donner. L'application, elle, tourne déjà sur la machine : elle
 * affiche la notification elle-même, sans serveur ni abonnement.
 */
export function notifierSysteme(titre: string, corps: string, marque?: string): void {
  if (typeof window === "undefined") return;

  const pont = window.electronLOL;
  if (pont?.notifier) { pont.notifier(titre, corps); return; }

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(titre, { body: corps, icon: "/icon", tag: marque });
  } catch { /* certains navigateurs refusent hors service worker */ }
}

/**
 * Vrai quand un rappel peut réellement s'afficher — donc quand il vaut la peine
 * d'en proposer l'activation.
 */
export function notificationsPossibles(): boolean {
  if (typeof window === "undefined") return false;
  if (window.electronLOL?.notifier) return true;
  return "Notification" in window;
}
