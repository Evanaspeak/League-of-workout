"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { betaAccess } from "@/lib/i18n/dictionaries/betaAccess";
import { Wordmark } from "@/components/Wordmark";

const FIELD_STYLE = {
  width: "100%",
  background: "rgba(12,14,17,0.6)",
  border: "1px solid var(--line-strong)",
  borderRadius: 8,
  padding: "12px 14px",
  color: "var(--bone)",
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box" as const,
  colorScheme: "dark" as const,
};

const OPTION_STYLE = { background: "#14171C", color: "#ECEFF4" };

const LABEL_STYLE = {
  display: "block",
  fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
  fontSize: "0.68rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "var(--steel)",
  marginBottom: 6,
};

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ display: "inline-block", verticalAlign: "-2px" }}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export default function BetaPage() {
  const t = useT(betaAccess);
  const { locale } = useLocale();

  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ pseudo, email, genre, age, poids, taille, sportsHoursPerWeek }),
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
    <div className="full-bleed" style={{
      background: "var(--ink)",
      minHeight: "100dvh",
      color: "var(--bone)",
      marginTop: "-1.5rem",
      marginBottom: "-1.5rem",
    }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(12,14,17,0.85)", backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
            <Wordmark fontSize="1.05rem" />
          </Link>
          <Link href="/login" style={{ fontSize: "0.8rem", color: "var(--faint)", textDecoration: "none" }}>
            {t.alreadyAccount}
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 24px 100px" }}>
        {code ? (
          /* ── Écran succès : le code ── */
          <div style={{
            position: "relative",
            background: "var(--carbon)",
            border: "1px solid var(--line)",
            borderRadius: 16, padding: "36px 28px", textAlign: "center",
            overflow: "hidden",
          }}>
            <span aria-hidden style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent 15%, var(--victory) 50%, transparent 85%)",
            }} />
            <div style={{
              display: "inline-block", marginBottom: 20, padding: "4px 16px", borderRadius: 999,
              border: "1px solid rgba(47,217,138,0.3)", background: "var(--victory-soft)",
              fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
              fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--victory)",
            }}>
              {t.successBadge}
            </div>
            <h1 style={{
              fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
              fontWeight: 700, textTransform: "uppercase",
              fontSize: "1.6rem", marginBottom: 8,
            }}>
              {t.successTitle}
            </h1>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "24px 0" }}>
              <div style={LABEL_STYLE}>{t.yourPseudo}</div>
              <div style={{ fontSize: "1.1rem", color: "var(--bone)", fontWeight: 600 }}>{pseudo}</div>
              <div style={{ ...LABEL_STYLE, marginTop: 8 }}>{t.yourCode}</div>
              <div
                onClick={copyCode}
                className="mono-num"
                style={{
                  fontSize: "1.9rem", fontWeight: 600, letterSpacing: "0.22em",
                  color: "var(--bone)", cursor: "pointer", userSelect: "all",
                  padding: "14px", borderRadius: 10, background: "rgba(12,14,17,0.7)",
                  border: "1px dashed var(--line-strong)",
                }}
                title={t.copy}
              >
                {code}
              </div>
              <button onClick={copyCode} style={{
                fontSize: "0.78rem", color: copied ? "var(--victory)" : "var(--muted)",
                background: "transparent", border: "none", cursor: "pointer", padding: 4,
                display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center",
              }}>
                <CopyIcon /> {copied ? t.copied : t.copy}
              </button>
            </div>

            <p style={{ fontSize: "0.82rem", color: "#F5B84B", lineHeight: 1.6, marginBottom: 24 }}>
              {t.codeWarning}
            </p>

            <Link href="/login" className="lol-btn" style={{ padding: "12px 28px", fontSize: "0.95rem" }}>
              {t.goLogin}
            </Link>
          </div>
        ) : (
          /* ── Formulaire ── */
          <>
            <div style={{ marginBottom: 40 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 22,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "var(--victory)",
                  animation: "pulse 2s ease-in-out infinite",
                }} />
                <span className="eyebrow">{t.badge}</span>
              </div>
              <h1 style={{
                fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                fontWeight: 700, textTransform: "uppercase",
                fontSize: "clamp(2rem, 4.5vw, 2.7rem)", lineHeight: 1.05, marginBottom: 14,
              }}>
                {t.heading}
              </h1>
              <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.7 }}>
                {t.intro}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={LABEL_STYLE}>{t.pseudoLabel}</label>
                <input style={FIELD_STYLE} placeholder={t.pseudoPlaceholder} value={pseudo}
                  onChange={e => setPseudo(e.target.value)} required minLength={2} maxLength={24} autoFocus />
                <p style={{ fontSize: "0.75rem", color: "var(--faint)", marginTop: 6 }}>{t.pseudoHint}</p>
              </div>

              <div>
                <label style={LABEL_STYLE}>
                  {t.emailLabel} <span style={{ opacity: 0.6, textTransform: "none", letterSpacing: 0 }}>· {t.emailOptional}</span>
                </label>
                <input style={FIELD_STYLE} type="email" placeholder={t.emailPlaceholder} value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" />
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6 }}>{t.emailHint}</p>
              </div>

              {/* Section optionnelle repliable */}
              <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
                <button type="button" onClick={() => setShowOptional(o => !o)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", background: "var(--carbon)", border: "none", cursor: "pointer",
                  color: "var(--muted)", fontSize: "0.85rem",
                }}>
                  <span>{t.optionalTitle}</span>
                  <span style={{ color: "var(--steel)" }}>{showOptional ? "−" : "+"}</span>
                </button>
                {showOptional && (
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16, borderTop: "1px solid var(--line)" }}>
                    <p style={{ fontSize: "0.78rem", color: "var(--faint)", lineHeight: 1.5, margin: 0 }}>{t.optionalHint}</p>
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
                  background: "rgba(255,90,71,0.08)", border: "1px solid rgba(255,90,71,0.3)",
                  borderRadius: 8, padding: "10px 16px", fontSize: "0.875rem", color: "var(--loss)",
                }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={pseudo.trim().length < 2 || loading} className="lol-btn" style={{
                padding: "14px 32px", fontSize: "1rem",
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
