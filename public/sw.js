/*
 * Service worker de Win or Workout.
 *
 * Deux rôles, et deux seulement.
 *
 * 1. Les notifications. Il reste vivant quand l'onglet est fermé, pour
 *    prévenir entre deux parties — le seul moment où quelqu'un est réellement
 *    disponible pour payer sa dette.
 *
 * 2. Une page de secours quand le réseau ne répond pas. Elle a une raison
 *    d'être qui n'a rien d'esthétique : sans elle, Chrome ne considère pas
 *    l'application comme installable et n'émet jamais `beforeinstallprompt`.
 *    L'invitation à poser l'app sur l'écran d'accueil n'avait donc aucun
 *    chemin sur Android — le manifeste était complet, la fonction restait
 *    hors d'atteinte.
 *
 * Ce qu'il ne fait PAS, délibérément : mettre en cache le JavaScript, les
 * styles ou les données. Un cache d'assets sur une application qui se
 * redéploie plusieurs fois par jour sert des fragments périmés à des pages
 * neuves, et le symptôme — une page sans style, un écran blanc — ne ressemble
 * jamais à sa cause. Ici, une seule entrée en cache, et elle ne change pas.
 */

/** Nom versionné : le changer purge l'ancien contenu à l'activation. */
const CACHE = "wow-hors-ligne-1";
const PAGE_HORS_LIGNE = "/hors-ligne.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(PAGE_HORS_LIGNE))
      // Un échec de mise en cache ne doit pas empêcher l'installation : les
      // notifications, elles, marcheraient quand même.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

/**
 * Seules les navigations passent ici, et seulement quand la requête échoue.
 *
 * Tout le reste — scripts, styles, API — n'est pas intercepté du tout : le
 * `return` sans `respondWith` laisse le navigateur faire exactement ce qu'il
 * ferait sans service worker. C'est ce qui rend ce fichier sans effet sur le
 * fonctionnement normal de l'application.
 */
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const secours = await caches.match(PAGE_HORS_LIGNE);
      // Sans la page en cache, mieux vaut une réponse explicite qu'une
      // promesse résolue sur `undefined`, que le navigateur traite comme une
      // erreur réseau opaque.
      return secours ?? new Response(
        "Hors ligne — no connection",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }),
  );
});

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
