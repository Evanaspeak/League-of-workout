"use client";
import { useEffect, useState } from "react";

// Affiché sur la page de login uniquement quand on tourne dans l'app desktop.
// Propose d'ouvrir Chrome pour contourner le blocage OAuth Google/Discord.
export function DesktopLoginButton() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    Promise.resolve(!!window.electronLOL?.isDesktop).then(setIsDesktop);
  }, []);

  if (!isDesktop) return null;

  return (
    <div className="space-y-2 pt-2" style={{ borderTop: "1px solid rgba(200,170,110,0.15)" }}>
      <p className="text-xs text-center" style={{ color: "rgba(240,230,211,0.45)" }}>
        Google et Discord bloquent la connexion dans l&apos;app ?
      </p>
      <button
        className="lol-btn w-full"
        style={{ background: "linear-gradient(to bottom, #1a3a5c, #0f2540)" }}
        onClick={() => window.electronLOL?.openGoogleLogin()}
      >
        🌐 Se connecter via votre navigateur
      </button>
    </div>
  );
}
