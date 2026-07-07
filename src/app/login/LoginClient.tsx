"use client";
import Link from "next/link";
import { LoginButtons } from "@/components/LoginButtons";
import { DesktopModeDetector } from "@/components/DesktopModeDetector";
import { Wordmark } from "@/components/Wordmark";
import { useT } from "@/lib/i18n/LocaleContext";
import { login as loginDict } from "@/lib/i18n/dictionaries/login";

export function LoginClient({
  betaFull,
  betaPending,
  betaRejected,
  transferred,
  deleted,
}: {
  betaFull: boolean;
  betaPending: boolean;
  betaRejected: boolean;
  transferred?: string;
  deleted?: string;
}) {
  const t = useT(loginDict);

  const card: React.CSSProperties = {
    position: "relative",
    background: "var(--carbon)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: "2.5rem 2rem",
    width: "100%",
    textAlign: "center",
    overflow: "hidden",
  };

  // Liseré ember en haut de la carte — la signature de la marque
  const topSlash = (
    <span aria-hidden style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 2,
      background: "linear-gradient(90deg, transparent 15%, var(--ember) 50%, transparent 85%)",
    }} />
  );

  if (transferred === "1") {
    return (
      <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...card, maxWidth: 360 }}>
          {topSlash}
          <div style={{ fontSize: "2rem", color: "var(--victory)", marginBottom: "1rem" }}>✓</div>
          <p style={{
            fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
            fontWeight: 600,
            fontSize: "1.15rem",
            color: "var(--bone)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.75rem",
          }}>
            {t.connexionReussieTitle}
          </p>
          <p style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.65 }}>
            {t.connexionReussieBody}<br />{t.connexionReussieClose}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <DesktopModeDetector />
      <div style={{ ...card, maxWidth: 400 }}>
        {topSlash}

        {deleted === "1" && (
          <div style={{
            padding: "0.7rem 0.9rem",
            marginBottom: "1.5rem",
            background: "var(--victory-soft)",
            border: "1px solid rgba(47,217,138,0.3)",
            borderRadius: 8,
            fontSize: "0.82rem",
            color: "var(--victory)",
          }}>
            {t.compteSupprime}
          </div>
        )}

        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.8rem" }}>
            <Wordmark fontSize="1.35rem" />
          </div>
          <p className="eyebrow" style={{ marginTop: "0.4rem" }}>
            {t.accesReserve}
          </p>
        </div>

        {betaPending ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 10,
              background: "rgba(236,239,244,0.04)",
              border: "1px solid var(--line-strong)",
            }}>
              <p style={{ fontWeight: 600, color: "var(--bone)", marginBottom: "0.3rem" }}>{t.candidatureEnCours}</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
                {t.candidatureEnCoursBody}
              </p>
            </div>
          </div>
        ) : betaRejected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 10,
              background: "rgba(255,90,71,0.08)",
              border: "1px solid rgba(255,90,71,0.28)",
            }}>
              <p className="loss-text" style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{t.candidatureNonRetenue}</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
                {t.candidatureNonRetenueBody}
              </p>
            </div>
          </div>
        ) : betaFull ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 10,
              background: "rgba(255,90,71,0.08)",
              border: "1px solid rgba(255,90,71,0.28)",
            }}>
              <p className="loss-text" style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{t.accesRefuse}</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                {t.accesRefuseBody}
              </p>
            </div>
            <Link href="/beta" className="lol-btn" style={{ display: "inline-block" }}>
              {t.candidaterBeta}
            </Link>
          </div>
        ) : (
          <LoginButtons />
        )}

        <p style={{
          marginTop: "1.5rem",
          fontSize: "0.7rem",
          color: "rgba(236,239,244,0.3)",
          lineHeight: 1.7,
        }}>
          {t.mentionsAcceptation}{" "}
          <Link href="/cgu" style={{ color: "var(--faint)" }}>{t.cgu}</Link>
          {" "}{t.et}{" "}
          <Link href="/confidentialite" style={{ color: "var(--faint)" }}>{t.politiqueConfidentialite}</Link>.
        </p>
      </div>
    </div>
  );
}
