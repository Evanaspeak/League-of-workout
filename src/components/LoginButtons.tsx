"use client";
import { useEffect, useState } from "react";
import { signInWithGoogle, signInWithDiscord } from "@/lib/auth-actions";

export function LoginButtons() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const desktop = !!window.electronLOL?.isDesktop;
    setIsDesktop(desktop);
    // Restaure la préférence sauvegardée
    const saved = localStorage.getItem("low_rm");
    if (desktop || saved === "true") setRememberMe(true);
  }, []);

  const saveRm = () => {
    localStorage.setItem("low_rm", rememberMe ? "true" : "false");
  };

  const checkbox = (
    <label style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      cursor: isDesktop ? "default" : "pointer",
      userSelect: "none",
      marginTop: 4,
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
      <form action={signInWithGoogle} onSubmit={saveRm}>
        <button type="submit" className="lol-btn w-full">
          Se connecter avec Google
        </button>
      </form>
      <form action={signInWithDiscord} onSubmit={saveRm}>
        <button
          type="submit"
          className="lol-btn w-full"
          style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
        >
          Se connecter avec Discord
        </button>
      </form>
      {checkbox}
      <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
        Seuls les 100 premiers inscrits ont accès pendant la beta.
      </p>
    </div>
  );
}
