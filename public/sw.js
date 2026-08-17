/*
 * Service worker de Win or Workout.
 *
 * Il ne sert qu'aux notifications : pas de cache hors ligne, pas
 * d'interception de requêtes. Son intérêt est de rester vivant quand l'onglet
 * est fermé, pour prévenir entre deux parties — le seul moment où quelqu'un
 * est réellement disponible pour payer sa dette.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Charge illisible : on prévient quand même plutôt que de rester muet.
  }

  const titre = data.titre || "Win or Workout";
  const options = {
    body: data.corps || "",
    icon: "/icon",
    badge: "/icon",
    tag: data.tag || "wow",
    // Une nouvelle notification remplace la précédente du même tag sans
    // re-sonner : on ne harcèle pas quelqu'un en pleine partie.
    renotify: false,
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      // Si l'app est déjà ouverte quelque part, on la ramène au premier plan
      // plutôt que d'ouvrir un onglet de plus.
      for (const f of fenetres) {
        if (f.url.includes(self.location.origin) && "focus" in f) {
          f.navigate(cible);
          return f.focus();
        }
      }
      return self.clients.openWindow(cible);
    }),
  );
});
