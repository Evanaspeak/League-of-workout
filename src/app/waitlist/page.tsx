"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { waitlist as waitlistDict } from "@/lib/i18n/dictionaries/waitlist";

export default function WaitlistPage() {
  const t = useT(waitlistDict);
  return (
    <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="lol-panel" style={{
        position: "relative",
        padding: "2.5rem 2rem",
        width: "100%", maxWidth: 380,
        textAlign: "center",
        overflow: "hidden",
      }}>
        <span aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 15%, var(--ember) 50%, transparent 85%)",
        }} />

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.2rem" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--steel)"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </div>
        <h1 style={{
          fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
          fontWeight: 700,
          fontSize: "1.3rem",
          color: "var(--bone)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "1.25rem",
        }}>
          {t.title}
        </h1>
        <p style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.7, marginBottom: "1.75rem" }}>
          {t.body}
        </p>
        {/* Le calculateur plutôt que rien.
            Le bouton menait à `/login`, ce qui n'aide personne : on arrive ici
            justement parce qu'on ne peut pas ouvrir de compte. Le calculateur,
            lui, est public et répond à la question qui a amené la personne —
            ce que coûte une défaite. Une page qui ferme une porte doit en
            ouvrir une autre, sinon elle n'est qu'un mur. */}
        <p style={{
          fontSize: "0.82rem", color: "var(--steel)", lineHeight: 1.6,
          marginBottom: "1.1rem",
        }}>
          {t.calculateurInvite}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <Link href="/calculateur" className="lol-btn" style={{ display: "inline-block" }}>
            {t.calculateurLien}
          </Link>
          <Link href="/" style={{ fontSize: "0.8rem", color: "var(--steel)" }}>
            {t.retour}
          </Link>
        </div>
      </div>
    </div>
  );
}
