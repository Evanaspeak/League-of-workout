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
        // Navigate instead of fetch — bypasses Chrome CORS/Private Network Access
        // restrictions that block HTTPS→HTTP localhost fetch() requests.
        window.location.assign(
          `http://localhost:3099/set-session?t=${encodeURIComponent(data.jwt)}`
        );
      })
      .catch(() => {});
  }, []);

  return null;
}
