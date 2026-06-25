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

    const rm = localStorage.getItem("low_rm");
    if (rm !== "false") return;

    const params = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get("li") === "1";

    if (justLoggedIn) {
      params.delete("li");
      const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", clean);
      document.cookie = "low_session=1; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
      return;
    }

    const hasSession = document.cookie.split(";").some((c) => c.trim().startsWith("low_session="));
    if (hasSession) return;

    // signOut() d'Auth.js supprime proprement tous ses cookies (__Secure-, __Host-, etc.)
    signOut({ redirect: false }).then(() => {
      window.location.href = "/login";
    });
  }, [path]);

  return null;
}
