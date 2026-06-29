"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { signInWithGoogle, signInWithDiscord } from "@/lib/auth-actions";

type Tab = "google" | "discord" | "email";
type Mode = "login" | "register";

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "0.55rem 0.25rem",
  fontSize: "0.78rem",
  letterSpacing: "0.06em",
  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
  background: "transparent",
  border: "none",
  borderBottom: active ? "2px solid #C8AA6E" : "2px solid transparent",
  color: active ? "#C8AA6E" : "rgba(240,230,211,0.4)",
  cursor: "pointer",
  transition: "color 0.2s, border-color 0.2s",
});

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(200,170,110,0.2)",
  borderRadius: 4,
  color: "#F0E6D3",
  fontSize: "0.88rem",
  outline: "none",
  boxSizing: "border-box",
};

export function LoginButtons() {
  const [tab, setTab] = useState<Tab>("google");
  const [mode, setMode] = useState<Mode>("login");
  const [isDesktop, setIsDesktop] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setIsDesktop(!!window.electronLOL?.isDesktop);
    const saved = localStorage.getItem("low_rm");
    if (saved === "false") setRememberMe(false);
  }, []);

  const saveRm = () => {
    localStorage.setItem("low_rm", rememberMe ? "true" : "false");
    // Pose low_session maintenant (survit à la redirection OAuth)
    document.cookie = "low_session=1; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    saveRm();
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Email ou mot de passe incorrect");
      } else {
        window.location.href = "/dashboard?li=1";
      }
    } catch {
      setError("Erreur de connexion, réessayez");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas"); return; }
    if (password.length < 8) { setError("Mot de passe trop court (min 8 caractères)"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, pseudo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur lors de la création du compte"); return; }
      saveRm();
      const loginResult = await signIn("credentials", { email, password, redirect: false });
      if (loginResult?.error) {
        setSuccess("Compte créé ! Connectez-vous maintenant.");
        setMode("login");
      } else {
        window.location.href = "/dashboard?li=1";
      }
    } catch {
      setError("Erreur serveur, réessayez");
    } finally {
      setLoading(false);
    }
  };

  const checkbox = (
    <label style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      cursor: "pointer", userSelect: "none", marginTop: 4,
    }}>
      <input
        type="checkbox"
        checked={rememberMe}
        onChange={(e) => setRememberMe(e.target.checked)}
        style={{ accentColor: "#C8AA6E", width: 14, height: 14, cursor: "pointer" }}
      />
      <span style={{ fontSize: "0.8rem", color: "rgba(240,230,211,0.55)" }}>Rester connecté</span>
    </label>
  );

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid rgba(200,170,110,0.12)",
        marginBottom: "1.25rem",
      }}>
        <button style={TAB_STYLE(tab === "google")} onClick={() => setTab("google")}>GOOGLE</button>
        <button style={TAB_STYLE(tab === "discord")} onClick={() => setTab("discord")}>DISCORD</button>
        <button style={TAB_STYLE(tab === "email")} onClick={() => setTab("email")}>EMAIL</button>
      </div>

      {/* Google tab */}
      {tab === "google" && (
        <div className="space-y-3">
          {isDesktop ? (
            <button
              className="lol-btn w-full"
              onClick={() => { saveRm(); window.electronLOL?.openGoogleLogin(); }}
            >
              Se connecter avec Google
            </button>
          ) : (
            <form action={signInWithGoogle} onSubmit={saveRm}>
              <button type="submit" className="lol-btn w-full">
                Se connecter avec Google
              </button>
            </form>
          )}
          {checkbox}
          <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)", textAlign: "center" }}>
            Seuls les 100 premiers inscrits ont accès.
          </p>
        </div>
      )}

      {/* Discord tab */}
      {tab === "discord" && (
        <div className="space-y-3">
          {isDesktop ? (
            <button
              className="lol-btn w-full"
              style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
              onClick={() => { saveRm(); window.electronLOL?.openDiscordLogin(); }}
            >
              Se connecter avec Discord
            </button>
          ) : (
            <form action={signInWithDiscord} onSubmit={saveRm}>
              <button
                type="submit"
                className="lol-btn w-full"
                style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
              >
                Se connecter avec Discord
              </button>
            </form>
          )}
          {checkbox}
          <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)", textAlign: "center" }}>
            Seuls les 100 premiers inscrits ont accès.
          </p>
        </div>
      )}

      {/* Email tab */}
      {tab === "email" && (
        <div>
          <div style={{
            display: "flex", gap: 0, marginBottom: "1rem",
            background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: 3,
          }}>
            <button
              onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              style={{
                flex: 1, padding: "0.4rem", fontSize: "0.77rem", border: "none", borderRadius: 3,
                cursor: "pointer",
                background: mode === "login" ? "rgba(200,170,110,0.15)" : "transparent",
                color: mode === "login" ? "#C8AA6E" : "rgba(240,230,211,0.4)",
                fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                letterSpacing: "0.05em", transition: "all 0.15s",
              }}
            >
              CONNEXION
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              style={{
                flex: 1, padding: "0.4rem", fontSize: "0.77rem", border: "none", borderRadius: 3,
                cursor: "pointer",
                background: mode === "register" ? "rgba(200,170,110,0.15)" : "transparent",
                color: mode === "register" ? "#C8AA6E" : "rgba(240,230,211,0.4)",
                fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                letterSpacing: "0.05em", transition: "all 0.15s",
              }}
            >
              CRÉER UN COMPTE
            </button>
          </div>

          {error && (
            <div style={{
              padding: "0.6rem 0.8rem", marginBottom: "0.75rem",
              background: "rgba(232,64,87,0.1)", border: "1px solid rgba(232,64,87,0.3)",
              borderRadius: 4, fontSize: "0.82rem", color: "#e84057",
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: "0.6rem 0.8rem", marginBottom: "0.75rem",
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 4, fontSize: "0.82rem", color: "#22C55E",
            }}>
              {success}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleCredentialsLogin} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" style={INPUT_STYLE} />
              <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
                required autoComplete="current-password" style={INPUT_STYLE} />
              <button type="submit" disabled={loading} className="lol-btn w-full"
                style={{ marginTop: "0.25rem", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Connexion…" : "Se connecter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <input type="text" placeholder="Pseudo (affiché dans l'app)" value={pseudo}
                onChange={(e) => setPseudo(e.target.value)} required autoComplete="username" style={INPUT_STYLE} />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" style={INPUT_STYLE} />
              <input type="password" placeholder="Mot de passe (min 8 caractères)" value={password}
                onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" style={INPUT_STYLE} />
              <input type="password" placeholder="Confirmer le mot de passe" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" style={INPUT_STYLE} />
              <button type="submit" disabled={loading} className="lol-btn w-full"
                style={{ marginTop: "0.25rem", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Création…" : "Créer mon compte"}
              </button>
            </form>
          )}

          <div style={{ marginTop: "0.75rem" }}>{checkbox}</div>
          <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)", textAlign: "center", marginTop: "0.75rem" }}>
            Seuls les 100 premiers inscrits ont accès.
          </p>
        </div>
      )}
    </div>
  );
}
