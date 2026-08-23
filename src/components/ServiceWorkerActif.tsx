"use client";
import { useEffect } from "react";

/**
 * Enregistre le service worker au chargement.
 *
 * Il n'était posé que par le réglage des notifications, c'est-à-dire pour la
 * poignée de gens qui les activent. Or il porte aussi la page de secours hors
 * ligne, et c'est cette page qui rend l'application installable aux yeux de
 * Chrome : sans service worker actif, `beforeinstallprompt` n'est jamais émis
 * et l'invitation à poser l'app sur l'écran d'accueil n'a aucun chemin sur
 * Android.
 *
 * L'enregistrement est sans effet visible : le service worker n'intercepte que
 * les navigations, et seulement quand elles échouent.
 */
export function ServiceWorkerActif() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Après le chargement : l'enregistrement entre en concurrence avec les
    // requêtes de la page, et il n'y a aucune urgence à le faire avant.
    const poser = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Refusé — navigation privée, réglage du navigateur, page non
        // sécurisée. L'application marche sans, il n'y a rien à dire.
      });
    };
    if (document.readyState === "complete") { poser(); return; }
    window.addEventListener("load", poser);
    return () => window.removeEventListener("load", poser);
  }, []);
  return null;
}
