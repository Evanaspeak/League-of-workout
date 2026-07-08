"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { signInWithGoogle, signInWithDiscord } from "@/lib/auth-actions";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { loginButtons as loginButtonsDict } from "@/lib/i18n/dictionaries/loginButtons";
import { translateApiError } from "@/lib/i18n/apiErrors";

type Tab = "code" | "google" | "discord" | "email";
type Mode = "login" | "register";

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "0.55rem 0.25rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
  background: "transparent",
  border: "none",
  borderBottom: active ? "2px solid var(--ember)" : "2px solid transparent",
  color: active ? "var(--bone)" : "var(--faint)",
  cursor: "pointer",
  transition: "color 0.2s, border-color 0.2s",
});

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.85rem",
  background: "rgba(12,14,17,0.6)",
  border: "1px solid var(--line-strong)",
  borderRadius: 8,
  color: "var(--bone)",
  fontSize: "0.88rem",
  outline: "none",
  boxSizing: "border-box",
};

export function LoginButtons() {
  const t = useT(loginButtonsDict);
  const { locale } = useLocale();
  const [tab, setTab] = useState<Tab>("code");
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

  // Pseudo + code form state
  const [codePseudo, setCodePseudo] = useState("");
  const [codeValue, setCodeValue] = useState("");

  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    saveRm();
    try {
      const result = await signIn("credentials", { email: codePseudo, password: codeValue, redirect: false });
      if (result?.error) {
        setError(t.erreurPseudoCode);
      } else {
        window.location.href = "/dashboard?li=1";
      }
    } catch {
      setError(t.erreurConnexion);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsDesktop(!!window.electronLOL?.isDesktop);
    const saved = localStorage.getItem("low_rm");
    if (saved === "false") setRememberMe(false);
  }, []);

  const saveRm = () => {
    localStorage.setItem("low_rm", rememberMe ? "true" : "false");
    if (!rememberMe) {
      sessionStorage.setItem("low_alive", "1");
    }
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    saveRm();
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(t.erreurEmailMotDePasse);
      } else {
        window.location.href = "/dashboard?li=1";
      }
    } catch {
      setError(t.erreurConnexion);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) { setError(t.erreurMotDePasseDifferents); return; }
    if (password.length < 8) { setError(t.erreurMotDePasseTropCourt); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, pseudo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ? translateApiError(data.error, locale) : t.erreurCreationCompte); return; }
      saveRm();
      const loginResult = await signIn("credentials", { email, password, redirect: false });
      if (loginResult?.error) {
        setSuccess(t.compteCreeConnexion);
        setMode("login");
      } else {
        window.location.href = "/dashboard?li=1";
      }
    } catch {
      setError(t.erreurServeur);
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
        style={{ accentColor: "var(--ember)", width: 14, height: 14, cursor: "pointer" }}
      />
      <span style={{ fontSize: "0.8rem", color: "rgba(236,239,244,0.55)" }}>{t.resterConnecte}</span>
    </label>
  );

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--line)",
        marginBottom: "1.25rem",
      }}>
        <button style={TAB_STYLE(tab === "code")} onClick={() => setTab("code")}>{t.code}</button>
        <button style={TAB_STYLE(tab === "google")} onClick={() => setTab("google")}>{t.google}</button>
        <button style={TAB_STYLE(tab === "discord")} onClick={() => setTab("discord")}>{t.discord}</button>
        <button style={TAB_STYLE(tab === "email")} onClick={() => setTab("email")}>{t.email}</button>
      </div>

      {/* Pseudo + Code tab (méthode principale) */}
      {tab === "code" && (
        <div className="space-y-3">
          {error && (
            <div style={{
              padding: "0.6rem 0.8rem", marginBottom: "0.25rem",
              background: "rgba(255,90,71,0.1)", border: "1px solid rgba(255,90,71,0.3)",
              borderRadius: 4, fontSize: "0.82rem", color: "#FF5A47",
            }}>
              {error}
            </div>
          )}
          <form onSubmit={handleCodeLogin} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <input type="text" placeholder={t.codePseudoPlaceholder} value={codePseudo} onChange={(e) => setCodePseudo(e.target.value)}
              required autoComplete="username" style={INPUT_STYLE} />
            <input type="text" placeholder={t.codePlaceholder} value={codeValue} onChange={(e) => setCodeValue(e.target.value)}
              required autoComplete="one-time-code" style={{ ...INPUT_STYLE, letterSpacing: "0.15em" }} />
            <button type="submit" disabled={loading} className="lol-btn w-full" style={{ marginTop: "0.25rem", opacity: loading ? 0.6 : 1 }}>
              {loading ? t.connexionEnCours : t.seConnecter}
            </button>
          </form>
          {checkbox}
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)", textAlign: "center", marginTop: "0.5rem" }}>
            {t.noCodeYet}{" "}
            <Link href="/beta" style={{ color: "var(--ember)", textDecoration: "none", fontWeight: 600 }}>{t.getAccess}</Link>
          </p>
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)", textAlign: "center", marginTop: "0.25rem" }}>
            <Link href="/recuperation" style={{ color: "rgba(236,239,244,0.5)", textDecoration: "underline" }}>{t.forgotCode}</Link>
          </p>
        </div>
      )}

      {/* Google tab */}
      {tab === "google" && (
        <div className="space-y-3">
          {isDesktop ? (
            <button
              className="lol-btn w-full"
              onClick={() => { saveRm(); window.electronLOL?.openGoogleLogin(); }}
            >
              {t.connexionAvecGoogle}
            </button>
          ) : (
            <form action={signInWithGoogle} onSubmit={saveRm}>
              <button type="submit" className="lol-btn w-full">
                {t.connexionAvecGoogle}
              </button>
            </form>
          )}
          {checkbox}
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)", textAlign: "center" }}>
            {t.seulement100}
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
              {t.connexionAvecDiscord}
            </button>
          ) : (
            <form action={signInWithDiscord} onSubmit={saveRm}>
              <button
                type="submit"
                className="lol-btn w-full"
                style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
              >
                {t.connexionAvecDiscord}
              </button>
            </form>
          )}
          {checkbox}
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)", textAlign: "center" }}>
            {t.seulement100}
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
                background: mode === "login" ? "rgba(152,162,176,0.15)" : "transparent",
                color: mode === "login" ? "#ECEFF4" : "rgba(236,239,244,0.4)",
                fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                letterSpacing: "0.05em", transition: "all 0.15s",
              }}
            >
              {t.connexion}
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              style={{
                flex: 1, padding: "0.4rem", fontSize: "0.77rem", border: "none", borderRadius: 3,
                cursor: "pointer",
                background: mode === "register" ? "rgba(152,162,176,0.15)" : "transparent",
                color: mode === "register" ? "#ECEFF4" : "rgba(236,239,244,0.4)",
                fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                letterSpacing: "0.05em", transition: "all 0.15s",
              }}
            >
              {t.creerUnCompte}
            </button>
          </div>

          {error && (
            <div style={{
              padding: "0.6rem 0.8rem", marginBottom: "0.75rem",
              background: "rgba(255,90,71,0.1)", border: "1px solid rgba(255,90,71,0.3)",
              borderRadius: 4, fontSize: "0.82rem", color: "#FF5A47",
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: "0.6rem 0.8rem", marginBottom: "0.75rem",
              background: "rgba(47,217,138,0.1)", border: "1px solid rgba(47,217,138,0.3)",
              borderRadius: 4, fontSize: "0.82rem", color: "#2FD98A",
            }}>
              {success}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleCredentialsLogin} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <input type="email" placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" style={INPUT_STYLE} />
              <input type="password" placeholder={t.motDePassePlaceholder} value={password} onChange={(e) => setPassword(e.target.value)}
                required autoComplete="current-password" style={INPUT_STYLE} />
              <button type="submit" disabled={loading} className="lol-btn w-full"
                style={{ marginTop: "0.25rem", opacity: loading ? 0.6 : 1 }}>
                {loading ? t.connexionEnCours : t.seConnecter}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <input type="text" placeholder={t.pseudoPlaceholder} value={pseudo}
                onChange={(e) => setPseudo(e.target.value)} required autoComplete="username" style={INPUT_STYLE} />
              <input type="email" placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" style={INPUT_STYLE} />
              <input type="password" placeholder={t.motDePasseMinPlaceholder} value={password}
                onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" style={INPUT_STYLE} />
              <input type="password" placeholder={t.confirmerMotDePassePlaceholder} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" style={INPUT_STYLE} />
              <button type="submit" disabled={loading} className="lol-btn w-full"
                style={{ marginTop: "0.25rem", opacity: loading ? 0.6 : 1 }}>
                {loading ? t.creationEnCours : t.creerMonCompte}
              </button>
            </form>
          )}

          <div style={{ marginTop: "0.75rem" }}>{checkbox}</div>
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)", textAlign: "center", marginTop: "0.75rem" }}>
            {t.seulement100}
          </p>
        </div>
      )}
    </div>
  );
}
