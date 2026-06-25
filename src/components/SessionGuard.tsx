"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PUBLIC = ["/login", "/waitlist", "/api/"];

// "Rester connecté" = false → on pose un cookie de session navigateur (sans maxAge).
// Ce cookie disparaît quand le navigateur ferme. Au prochain démarrage,
// son absence déclenche la déconnexion.
export function SessionGuard() {
  const path = usePathname();

  useEffect(() => {
    if (PUBLIC.some((p) => path.startsWith(p))) return;
    if (typeof window === "undefined") return;
    if (window.electronLOL?.isDesktop) return; // Desktop : toujours mémorisé

    const rm = localStorage.getItem("low_rm");
    if (rm !== "false") return; // Mémorisé (ou préférence non définie) → rien à faire

    // Détecte une connexion fraîche via le paramètre ?li=1 posé par auth-actions.
    const params = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get("li") === "1";

    if (justLoggedIn) {
      params.delete("li");
      const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", clean);
      // Pose le cookie de session (pas de maxAge = cookie de session navigateur).
      document.cookie = "low_session=1; path=/; SameSite=Lax";
      return;
    }

    const hasSession = document.cookie.split(";").some((c) => c.trim().startsWith("low_session="));
    if (hasSession) return; // Navigateur toujours ouvert, OK

    // Aucun cookie de session + pas de connexion fraîche = navigateur rouvert → déconnexion.
    window.location.href = "/api/auth/session-expired";
  }, [path]);

  return null;
}
