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

    // Nettoie ?li=1 et pose le cookie de session peu importe l'option "Rester connecté"
    const params = new URLSearchParams(window.location.search);
    if (params.get("li") === "1") {
      params.delete("li");
      const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", clean);
      document.cookie = "low_session=1; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
      return;
    }

    // Si "Rester connecté" est actif (ou jamais configuré), on ne déconnecte pas
    const rm = localStorage.getItem("low_rm");
    if (rm !== "false") return;

    // Sinon : vérifie que la session de navigation est encore active
    const hasSession = document.cookie.split(";").some((c) => c.trim().startsWith("low_session="));
    if (hasSession) return;

    signOut({ redirect: false }).then(() => {
      window.location.href = "/login";
    });
  }, [path]);

  return null;
}
