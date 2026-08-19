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
    // Ne s'exécute que si Electron a ouvert Chrome avec ?_desktop=1 ET son aléa.
    if (!localStorage.getItem("low_desktop_handoff")) return;
    const nonce = localStorage.getItem("low_desktop_nonce");
    if (!nonce) return;

    // Un échec ici laissait l'utilisateur sur un dashboard d'apparence normale
    // pendant que l'application restait déconnectée, sans rien pour le dire.
    // On le nomme, sinon la panne est indiscernable d'une réussite.
    const echouer = (raison: string) => {
      localStorage.removeItem("low_desktop_handoff");
      localStorage.removeItem("low_desktop_nonce");
      window.location.assign(`/login?transfer_error=${raison}`);
    };

    fetch("/api/auth/desktop-token", { method: "POST" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.jwt) return echouer("token");
        // Nettoie le flag avant de naviguer pour éviter toute boucle.
        localStorage.removeItem("low_desktop_handoff");
        localStorage.removeItem("low_desktop_nonce");
        // Navigation plutôt que fetch : contourne les restrictions CORS et
        // Private Network Access de Chrome sur HTTPS→HTTP localhost. C'est
        // aussi ce qui rendait le canal atteignable depuis n'importe quel site,
        // d'où l'aléa qui accompagne désormais le jeton.
        window.location.assign(
          `http://localhost:3099/set-session?t=${encodeURIComponent(data.jwt)}`
          + `&n=${encodeURIComponent(nonce)}`
        );
      })
      .catch(() => echouer("reseau"));
  }, []);

  return null;
}
