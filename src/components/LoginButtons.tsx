"use client";
import { useEffect, useState } from "react";
import { signInWithGoogle, signInWithDiscord } from "@/lib/auth-actions";

// En mode navigateur : soumet les formulaires via les server actions (flux OAuth normal).
// En mode Electron : ouvre Chrome sur /login pour que Chrome gère l'INTÉGRALITÉ
// du flux OAuth (cookie CSRF, callback, session) — évite le mismatch CSRF.
export function LoginButtons() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    Promise.resolve(!!window.electronLOL?.isDesktop).then(setIsDesktop);
  }, []);

  if (isDesktop) {
    const openBrowser = () => window.electronLOL?.openBrowserLogin();
    return (
      <div className="space-y-3">
        <button className="lol-btn w-full" onClick={openBrowser}>
          Se connecter avec Google
        </button>
        <button
          className="lol-btn w-full"
          style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
          onClick={openBrowser}
        >
          Se connecter avec Discord
        </button>
        <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
          Votre navigateur s&apos;ouvrira pour finaliser la connexion.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form action={signInWithGoogle}>
        <button type="submit" className="lol-btn w-full">
          Se connecter avec Google
        </button>
      </form>
      <form action={signInWithDiscord}>
        <button
          type="submit"
          className="lol-btn w-full"
          style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
        >
          Se connecter avec Discord
        </button>
      </form>
      <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
        Seuls les 100 premiers inscrits ont accès pendant la beta.
      </p>
    </div>
  );
}
