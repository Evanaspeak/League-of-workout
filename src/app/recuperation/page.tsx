"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { recuperation } from "@/lib/i18n/dictionaries/recuperation";
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
};

const LABEL_STYLE = {
  display: "block",
  fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
  fontSize: "0.68rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "var(--steel)",
  marginBottom: 6,
};

export default function RecuperationPage() {
  const t = useT(recuperation);
  const { locale } = useLocale();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(translateApiError(data.error, locale) || t.genericError); return; }
      setSent(true);
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
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
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center" }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
            <Wordmark fontSize="1.05rem" />
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "56px 24px 100px" }}>
        {sent ? (
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
              {t.successTitle}
            </div>
            <p style={{ fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.7, marginBottom: 24 }}>
              {t.successBody}
            </p>
            <Link href="/login" className="lol-btn" style={{ padding: "12px 28px", fontSize: "0.9rem" }}>
              {t.backToLogin}
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <div className="eyebrow" style={{ marginBottom: 20 }}>{t.badge}</div>
              <h1 style={{
                fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                fontWeight: 700, textTransform: "uppercase",
                fontSize: "clamp(1.9rem, 4vw, 2.4rem)", lineHeight: 1.05, marginBottom: 14,
              }}>
                {t.heading}
              </h1>
              <p style={{ fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.7 }}>
                {t.intro}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={LABEL_STYLE}>{t.emailLabel}</label>
                <input style={FIELD_STYLE} type="email" placeholder={t.emailPlaceholder} value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
              </div>

              {error && (
                <div style={{
                  background: "rgba(255,90,71,0.08)", border: "1px solid rgba(255,90,71,0.3)",
                  borderRadius: 8, padding: "10px 16px", fontSize: "0.875rem", color: "var(--loss)",
                }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={!email.includes("@") || loading} className="lol-btn" style={{ padding: "14px 32px", fontSize: "0.95rem" }}>
                {loading ? t.submitting : t.submit}
              </button>
            </form>

            <div style={{ marginTop: 28, padding: "16px 18px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--carbon)" }}>
              <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--bone)", marginBottom: 4 }}>{t.noEmailTitle}</p>
              <p style={{ fontSize: "0.8rem", color: "var(--faint)", lineHeight: 1.6 }}>{t.noEmailBody}</p>
            </div>

            <p style={{ marginTop: 24, textAlign: "center" }}>
              <Link href="/login" style={{ fontSize: "0.8rem", color: "var(--faint)", textDecoration: "none" }}>
                {t.backToLogin}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
