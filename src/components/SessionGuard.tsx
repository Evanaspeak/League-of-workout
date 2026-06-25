"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PUBLIC = ["/login", "/waitlist", "/api/"];

// Enforce "non mémorisé" : si l'utilisateur a décoché "Rester connecté",
// on le déconnecte dès qu'il ouvre un nouvel onglet ou redémarre son navigateur.
// Mécanisme : sessionStorage se vide à la fermeture du navigateur.
// ?li=1 dans l'URL signale une toute première connexion (pas un restart).
export function SessionGuard() {
  const path = usePathname();

  useEffect(() => {
    if (PUBLIC.some((p) => path.startsWith(p))) return;
    if (typeof window === "undefined") return;
    // L'app desktop est toujours mémorisée (token transféré via port 3099).
    if (window.electronLOL?.isDesktop) return;

    const params = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get("li") === "1";

    // Nettoie le marqueur d'URL sans rechargement.
    if (justLoggedIn) {
      params.delete("li");
      const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", clean);
    }

    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((session) => {
        if (!session?.user) return;

        if (session.user.rememberMe === false) {
          if (justLoggedIn || sessionStorage.getItem("low_s")) {
            // Session navigateur active → maintient la clé.
            sessionStorage.setItem("low_s", "1");
          } else {
            // Aucune clé + pas de première connexion = restart navigateur → déconnexion.
            window.location.href = "/api/auth/session-expired";
          }
        }
      })
      .catch(() => {});
  }, [path]);

  return null;
}
