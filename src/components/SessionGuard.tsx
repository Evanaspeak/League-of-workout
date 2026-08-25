"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { estPagePublique } from "@/lib/pagesPubliques";
import { ecrireSession, lire, lireSession } from "@/lib/stockage";

export function SessionGuard() {
  const path = usePathname();

  useEffect(() => {
    // La liste des pages publiques est commune au rail, à la visite, au
    // compteur et à l'accueil. Celle qui était recopiée ici ne connaissait ni
    // les CGU ni la politique de confidentialité : quelqu'un qui avait décoché
    // « rester connecté » et qui ouvrait les conditions dans une nouvelle
    // session de navigateur se faisait renvoyer vers la page de connexion, au
    // lieu de lire le texte qu'il était venu lire.
    if (estPagePublique(path)) return;
    if (typeof window === "undefined") return;
    if (window.electronLOL?.isDesktop) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("li") === "1") {
      // Première arrivée après connexion → marque la session navigateur comme active
      ecrireSession("low_alive", "1");

      // Les connexions OAuth repartent par une redirection : impossible de
      // demander un cookie volatile depuis la page de connexion, qu'on a déjà
      // quittée. On le fait ici, au premier atterrissage, sinon la case
      // décochée ne changerait rien pour Google et Discord.
      if (lire("low_rm") === "false") {
        fetch("/api/auth/session-volatile", { method: "POST" }).catch(() => {});
      }

      params.delete("li");
      const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", clean);
      return;
    }

    // Si "Rester connecté" est actif (ou jamais configuré), pas de déconnexion auto
    const rm = lire("low_rm");
    if (rm !== "false") return;

    // "Rester connecté" désactivé : la session n'est valide que tant que l'onglet reste ouvert
    const alive = lireSession("low_alive");
    if (alive) return;

    // sessionStorage vide = le navigateur a été fermé et rouvert → déconnexion
    signOut({ redirect: false }).then(() => {
      window.location.href = "/login";
    });
  }, [path]);

  return null;
}
