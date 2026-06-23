"use client";
import { useEffect } from "react";

// Exécuté dans Chrome après un OAuth réussi.
// Tente de transférer le JWT de session à l'app Electron (port 3099) une seule
// fois par session Chrome. Échoue silencieusement si Electron n'est pas lancé.
export function DesktopAuthHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;
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
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
