"use client";
import { useEffect } from "react";

// Exécuté dans Chrome après un OAuth réussi.
// Tente de transférer le JWT de session à l'app Electron (port 3099) une seule
// fois par session Chrome. Échoue silencieusement si Electron n'est pas lancé.
export function DesktopAuthHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Ne s'exécute que dans Chrome, pas dans l'app Electron.
    if (window.electronLOL?.isDesktop) return;
    if (sessionStorage.getItem("desktop_synced")) return;

    fetch("/api/auth/desktop-token", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.jwt) return;
        sessionStorage.setItem("desktop_synced", "1");
        return fetch("http://localhost:3099/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jwt: data.jwt }),
        }).then((r) => {
          if (r.ok) {
            // Electron a reçu la session → déconnecte Chrome et affiche la page de succès.
            window.location.replace("/api/auth/desktop-complete");
          }
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
