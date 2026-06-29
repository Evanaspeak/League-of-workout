"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const PUBLIC = ["/login", "/waitlist", "/api/"];

export function SessionGuard() {
  const path = usePathname();

  useEffect(() => {
    if (PUBLIC.some((p) => path.startsWith(p))) return;
    if (typeof window === "undefined") return;
    if (window.electronLOL?.isDesktop) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("li") === "1") {
      // Première arrivée après connexion → marque la session navigateur comme active
      sessionStorage.setItem("low_alive", "1");
      params.delete("li");
      const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", clean);
      return;
    }

    // Si "Rester connecté" est actif (ou jamais configuré), pas de déconnexion auto
    const rm = localStorage.getItem("low_rm");
    if (rm !== "false") return;

    // "Rester connecté" désactivé : la session n'est valide que tant que l'onglet reste ouvert
    const alive = sessionStorage.getItem("low_alive");
    if (alive) return;

    // sessionStorage vide = le navigateur a été fermé et rouvert → déconnexion
    signOut({ redirect: false }).then(() => {
      window.location.href = "/login";
    });
  }, [path]);

  return null;
}
