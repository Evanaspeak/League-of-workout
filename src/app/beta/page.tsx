"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { betaAccess } from "@/lib/i18n/dictionaries/betaAccess";

const FIELD_STYLE = {
  width: "100%",
  background: "rgba(240,230,211,0.04)",
  border: "1px solid rgba(200,170,110,0.2)",
  borderRadius: 8,
  padding: "12px 14px",
  color: "#F0E6D3",
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box" as const,
  colorScheme: "dark" as const,
};

const OPTION_STYLE = { background: "#0a0e1a", color: "#F0E6D3" };

const LABEL_STYLE = {
  display: "block",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "rgba(200,170,110,0.7)",
  marginBottom: 6,
};

export default function BetaPage() {
  const t = useT(betaAccess);
  const { locale } = useLocale();

  const [pseudo, setPseudo] = useState("");
  const [genre, setGenre] = useState("");
  const [age, setAge] = useState("");
  const [poids, setPoids] = useState("");
  const [taille, setTaille] = useState("");
  const [sportsHoursPerWeek, setSports] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/beta-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo, genre, age, poids, taille, sportsHoursPerWeek }),
      });
      const data = await res.json();
      if (!res.ok) { setError(translateApiError(data.error, locale) || t.genericError); return; }
      setCode(data.code);
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div style={{ background: "#040810", minHeight: "100dvh", color: "#F0E6D3" }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(4,8,16,0.88)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(200,170,110,0.16)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", letterSpacing: "0.14em", color: "#C8AA6E", textDecoration: "none" }}>
            ⚔ L·O·W
          </Link>
          <Link href="/login" style={{ fontSize: "0.8rem", color: "rgba(240,230,211,0.4)", textDecoration: "none" }}>
            {t.alreadyAccount}
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px 100px" }}>
        {code ? (
          /* ── Écran succès : le code ── */
          <div style={{
            background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.3)",
            borderRadius: 16, padding: "36px 28px", textAlign: "center",
          }}>
            <div style={{
              display: "inline-block", marginBottom: 20, padding: "4px 16px", borderRadius: 999,
              border: "1px solid rgba(76,175,80,0.3)", background: "rgba(76,175,80,0.08)",
              fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#4caf50",
            }}>
              {t.successBadge}
            </div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", marginBottom: 8 }}>{t.successTitle}</h1>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "24px 0" }}>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.6)" }}>{t.yourPseudo}</div>
              <div style={{ fontSize: "1.1rem", color: "#F0E6D3", fontWeight: 600 }}>{pseudo}</div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.6)", marginTop: 8 }}>{t.yourCode}</div>
              <div
                onClick={copyCode}
                style={{
                  fontFamily: "var(--font-heading)", fontSize: "2rem", letterSpacing: "0.25em",
                  color: "#C8AA6E", cursor: "pointer", userSelect: "all",
                  padding: "14px", borderRadius: 10, background: "rgba(200,170,110,0.08)",
                  border: "1px dashed rgba(200,170,110,0.35)",
                }}
                title={t.copy}
              >
                {code}
              </div>
              <button onClick={copyCode} style={{
                fontSize: "0.78rem", color: copied ? "#4caf50" : "rgba(240,230,211,0.5)",
                background: "transparent", border: "none", cursor: "pointer", padding: 4,
              }}>
                {copied ? t.copied : `⧉ ${t.copy}`}
              </button>
            </div>

            <p style={{ fontSize: "0.82rem", color: "rgba(239,180,80,0.85)", lineHeight: 1.6, marginBottom: 24 }}>
              ⚠ {t.codeWarning}
            </p>

            <Link href="/login" style={{
              display: "inline-block", padding: "12px 28px", borderRadius: 8,
              background: "linear-gradient(135deg, #C8AA6E, #a8893e)", color: "#040810",
              fontWeight: 700, textDecoration: "none", fontSize: "0.9rem",
            }}>
              {t.goLogin}
            </Link>
          </div>
        ) : (
          /* ── Formulaire ── */
          <>
            <div style={{ marginBottom: 40, textAlign: "center" }}>
              <div style={{
                display: "inline-block", marginBottom: 20, padding: "4px 16px", borderRadius: 999,
                border: "1px solid rgba(11,196,227,0.3)", background: "rgba(11,196,227,0.06)",
                fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#0bc4e3",
              }}>
                {t.badge}
              </div>
              <h1 style={{ fontFamily: "var(--font-heading, 'Russo One', sans-serif)", fontSize: "clamp(1.8rem, 4vw, 2.4rem)", lineHeight: 1.15, marginBottom: 14 }}>
                {t.heading}
              </h1>
              <p style={{ fontSize: "0.95rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.7 }}>
                {t.intro}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={LABEL_STYLE}>{t.pseudoLabel}</label>
                <input style={FIELD_STYLE} placeholder={t.pseudoPlaceholder} value={pseudo}
                  onChange={e => setPseudo(e.target.value)} required minLength={2} maxLength={24} autoFocus />
                <p style={{ fontSize: "0.75rem", color: "rgba(240,230,211,0.4)", marginTop: 6 }}>{t.pseudoHint}</p>
              </div>

              {/* Section optionnelle repliable */}
              <div style={{ border: "1px solid rgba(200,170,110,0.12)", borderRadius: 10, overflow: "hidden" }}>
                <button type="button" onClick={() => setShowOptional(o => !o)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", background: "rgba(240,230,211,0.02)", border: "none", cursor: "pointer",
                  color: "rgba(240,230,211,0.7)", fontSize: "0.85rem",
                }}>
                  <span>{t.optionalTitle}</span>
                  <span style={{ color: "rgba(200,170,110,0.6)" }}>{showOptional ? "−" : "+"}</span>
                </button>
                {showOptional && (
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16, borderTop: "1px solid rgba(200,170,110,0.1)" }}>
                    <p style={{ fontSize: "0.78rem", color: "rgba(240,230,211,0.4)", lineHeight: 1.5, margin: 0 }}>{t.optionalHint}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={LABEL_STYLE}>{t.genreLabel}</label>
                        <select style={FIELD_STYLE} value={genre} onChange={e => setGenre(e.target.value)}>
                          <option value="" style={OPTION_STYLE}>—</option>
                          {t.genreOptions.map(g => <option key={g} value={g} style={OPTION_STYLE}>{g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>{t.ageLabel}</label>
                        <input style={FIELD_STYLE} type="number" min={13} max={99} placeholder="25" value={age} onChange={e => setAge(e.target.value)} />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>{t.weightLabel}</label>
                        <input style={FIELD_STYLE} type="number" min={30} max={300} placeholder="75" value={poids} onChange={e => setPoids(e.target.value)} />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>{t.heightLabel}</label>
                        <input style={FIELD_STYLE} type="number" min={100} max={250} placeholder="178" value={taille} onChange={e => setTaille(e.target.value)} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={LABEL_STYLE}>{t.sportLabel}</label>
                        <input style={FIELD_STYLE} type="number" min={0} max={40} placeholder="3" value={sportsHoursPerWeek} onChange={e => setSports(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div style={{
                  background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.3)",
                  borderRadius: 8, padding: "10px 16px", fontSize: "0.875rem", color: "#ef5350",
                }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={pseudo.trim().length < 2 || loading} style={{
                padding: "14px 32px", borderRadius: 8, fontSize: "1rem",
                background: pseudo.trim().length >= 2 ? "linear-gradient(135deg, #C8AA6E, #a8893e)" : "rgba(200,170,110,0.15)",
                color: pseudo.trim().length >= 2 ? "#040810" : "rgba(200,170,110,0.4)",
                fontWeight: 700, cursor: pseudo.trim().length >= 2 && !loading ? "pointer" : "not-allowed",
                border: "none", letterSpacing: "0.05em",
                boxShadow: pseudo.trim().length >= 2 ? "0 4px 24px rgba(200,170,110,0.25)" : "none",
                transition: "all 0.2s",
              }}>
                {loading ? t.submitting : t.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
