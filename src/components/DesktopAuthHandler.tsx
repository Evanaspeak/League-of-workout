"use client";
import { useEffect } from "react";

// Exécuté dans Chrome (pas dans Electron) après un OAuth en mode desktop.
// Détecte ?desktop_auth=1 dans l'URL, récupère le JWT de session et l'envoie
// au serveur local Electron sur le port 3099 via un fetch CORS.
export function DesktopAuthHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get("desktop_auth")) return;

    // Nettoie l'URL pour ne pas re-déclencher au rechargement.
    window.history.replaceState({}, "", "/");

    fetch("/api/auth/desktop-token", { method: "POST" })
      .then((r) => r.json())
      .then(({ jwt }) => {
        if (!jwt) return;
        return fetch("http://localhost:3099/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jwt }),
        });
      })
      .catch(() => {
        // Port 3099 non disponible = app desktop pas lancée, on ignore.
      });
  }, []);

  return null;
}
