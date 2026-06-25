"use client";
import { useEffect, useState } from "react";
import { signInWithGoogle, signInWithDiscord } from "@/lib/auth-actions";

export function LoginButtons() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const desktop = !!window.electronLOL?.isDesktop;
    setIsDesktop(desktop);
    if (desktop) setRememberMe(true);
  }, []);

  const setRmCookie = (val: boolean) => {
    document.cookie = `low_rm=${val ? "1" : "0"}; max-age=300; path=/; SameSite=Lax`;
  };

  const checkbox = (
    <label style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      cursor: isDesktop ? "default" : "pointer",
      userSelect: "none",
    }}>
      <input
        type="checkbox"
        checked={rememberMe}
        disabled={isDesktop}
        onChange={(e) => setRememberMe(e.target.checked)}
        style={{ accentColor: "#C8AA6E", width: 14, height: 14, cursor: "inherit" }}
      />
      <span style={{ fontSize: "0.8rem", color: "rgba(240,230,211,0.55)" }}>Rester connecté</span>
    </label>
  );

  if (isDesktop) {
    return (
      <div className="space-y-3">
        <button className="lol-btn w-full" onClick={() => window.electronLOL?.openGoogleLogin()}>
          Se connecter avec Google
        </button>
        <button
          className="lol-btn w-full"
          style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
          onClick={() => window.electronLOL?.openDiscordLogin()}
        >
          Se connecter avec Discord
        </button>
        {checkbox}
        <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
          Google s&apos;ouvre dans votre navigateur · Discord reste dans l&apos;app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        className="lol-btn w-full"
        onClick={async () => { setRmCookie(rememberMe); await signInWithGoogle(); }}
      >
        Se connecter avec Google
      </button>
      <button
        className="lol-btn w-full"
        style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
        onClick={async () => { setRmCookie(rememberMe); await signInWithDiscord(); }}
      >
        Se connecter avec Discord
      </button>
      {checkbox}
      <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
        Seuls les 100 premiers inscrits ont accès pendant la beta.
      </p>
    </div>
  );
}
