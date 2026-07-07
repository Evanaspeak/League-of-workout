"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { telechargement as telechargementDict } from "@/lib/i18n/dictionaries/telechargement";

export function TelechargementClient({ downloadUrl }: { downloadUrl: string | null }) {
  const t = useT(telechargementDict);
  return (
    <div
      style={{ minHeight: "72vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        className="lol-panel"
        style={{
          position: "relative",
          padding: "2.5rem 2rem",
          width: "100%",
          maxWidth: 480,
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <span aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 15%, var(--ember) 50%, transparent 85%)",
        }} />

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.2rem" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--steel)"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2" y="4" width="20" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
            fontWeight: 700,
            fontSize: "1.4rem",
            color: "var(--bone)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          {t.title}
        </h1>

        <p
          style={{
            fontSize: "0.82rem",
            color: "rgba(236,239,244,0.45)",
            marginBottom: "2rem",
            lineHeight: 1.7,
          }}
        >
          {t.description}<br />
          {t.compatibilite}
        </p>

        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="lol-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}
          >
            {t.telecharger}
          </a>
        ) : (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: 6,
              background: "rgba(152,162,176,0.05)",
              border: "1px solid rgba(152,162,176,0.15)",
              fontSize: "0.85rem",
              color: "rgba(236,239,244,0.5)",
              lineHeight: 1.7,
            }}
          >
            {t.bientotDisponible}
          </div>
        )}

        <div
          style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(152,162,176,0.08)",
            fontSize: "0.75rem",
            color: "rgba(236,239,244,0.3)",
            lineHeight: 1.8,
            textAlign: "left",
          }}
        >
          <p style={{ fontWeight: 600, color: "rgba(236,239,244,0.45)", marginBottom: "0.5rem" }}>
            {t.commentCaFonctionne}
          </p>
          <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <li>{t.etape1}</li>
            <li>{t.etape2}</li>
            <li>{t.etape3}</li>
            <li>{t.etape4}</li>
          </ul>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <Link
            href="/dashboard"
            style={{ fontSize: "0.78rem", color: "rgba(152,162,176,0.45)", textDecoration: "none" }}
          >
            {t.retourDashboard}
          </Link>
        </div>
      </div>
    </div>
  );
}
