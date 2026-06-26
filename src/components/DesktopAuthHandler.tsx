"use client";
import { useEffect } from "react";

// Exécuté dans Chrome après un OAuth réussi, uniquement si Electron a ouvert
// Chrome avec ?_desktop=1 (flag sauvegardé en localStorage par DesktopModeDetector).
// Transfère le JWT à l'app Electron via navigation localhost:3099.
export function DesktopAuthHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Ne s'exécute pas dans l'app Electron elle-même.
    if (window.electronLOL?.isDesktop) return;
    // Ne s'exécute que si Electron a ouvert Chrome avec ?_desktop=1.
    if (!localStorage.getItem("low_desktop_handoff")) return;

    fetch("/api/auth/desktop-token", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.jwt) return;
        // Nettoie le flag avant de naviguer pour éviter toute boucle.
        localStorage.removeItem("low_desktop_handoff");
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
