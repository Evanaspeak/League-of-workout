"use client";
import Link from "next/link";
import { LoginButtons } from "@/components/LoginButtons";
import { DesktopModeDetector } from "@/components/DesktopModeDetector";
import { useT } from "@/lib/i18n/LocaleContext";
import { login as loginDict } from "@/lib/i18n/dictionaries/login";

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const s: React.CSSProperties = {
    position: "absolute", width: 18, height: 18,
    ...(pos === "tl" && { top: 0, left: 0, borderTop: "2px solid #C8AA6E", borderLeft: "2px solid #C8AA6E" }),
    ...(pos === "tr" && { top: 0, right: 0, borderTop: "2px solid #C8AA6E", borderRight: "2px solid #C8AA6E" }),
    ...(pos === "bl" && { bottom: 0, left: 0, borderBottom: "2px solid #C8AA6E", borderLeft: "2px solid #C8AA6E" }),
    ...(pos === "br" && { bottom: 0, right: 0, borderBottom: "2px solid #C8AA6E", borderRight: "2px solid #C8AA6E" }),
  };
  return <span style={s} />;
}

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

  if (transferred === "1") {
    return (
      <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="lol-panel" style={{
          position: "relative",
          padding: "2.5rem 2rem",
          width: "100%", maxWidth: 360,
          textAlign: "center",
          boxShadow: "0 0 60px rgba(200,170,110,0.07)",
        }}>
          <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
          <div style={{ fontSize: "2.2rem", color: "#22C55E", marginBottom: "1rem" }}>✓</div>
          <p style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "1rem",
            color: "#C8AA6E",
            letterSpacing: "0.12em",
            marginBottom: "0.75rem",
          }}>
            {t.connexionReussieTitle}
          </p>
          <p style={{ fontSize: "0.84rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.65 }}>
            {t.connexionReussieBody}<br />{t.connexionReussieClose}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <DesktopModeDetector />
      <div className="lol-panel" style={{
        position: "relative",
        padding: "2.5rem 2rem",
        width: "100%", maxWidth: 390,
        textAlign: "center",
        boxShadow: "0 0 90px rgba(200,170,110,0.07), 0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

        {deleted === "1" && (
          <div style={{
            padding: "0.7rem 0.9rem",
            marginBottom: "1.5rem",
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 4,
            fontSize: "0.82rem",
            color: "#22C55E",
          }}>
            {t.compteSupprime}
          </div>
        )}

        <div style={{ marginBottom: "2.25rem" }}>
          <div style={{
            fontSize: "2rem",
            marginBottom: "0.875rem",
            color: "#C8AA6E",
            textShadow: "0 0 24px rgba(200,170,110,0.6)",
          }}>⚔</div>
          <h1 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "1.15rem",
            color: "#C8AA6E",
            letterSpacing: "0.16em",
            textShadow: "0 0 22px rgba(200,170,110,0.3)",
            margin: 0,
          }}>
            {t.appTitle}
          </h1>
          <p style={{
            fontSize: "0.73rem",
            color: "rgba(240,230,211,0.35)",
            letterSpacing: "0.08em",
            marginTop: "0.5rem",
          }}>
            {t.accesReserve}
          </p>
        </div>

        {betaPending ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 6,
              background: "rgba(200,170,110,0.08)",
              border: "1px solid rgba(200,170,110,0.25)",
            }}>
              <p style={{ fontWeight: 600, color: "#C8AA6E", marginBottom: "0.3rem" }}>{t.candidatureEnCours}</p>
              <p style={{ fontSize: "0.82rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.6 }}>
                {t.candidatureEnCoursBody}
              </p>
            </div>
          </div>
        ) : betaRejected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 6,
              background: "rgba(194,59,34,0.1)",
              border: "1px solid rgba(194,59,34,0.28)",
            }}>
              <p className="loss-text" style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{t.candidatureNonRetenue}</p>
              <p style={{ fontSize: "0.82rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.6 }}>
                {t.candidatureNonRetenueBody}
              </p>
            </div>
          </div>
        ) : betaFull ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 6,
              background: "rgba(194,59,34,0.1)",
              border: "1px solid rgba(194,59,34,0.28)",
            }}>
              <p className="loss-text" style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{t.accesRefuse}</p>
              <p style={{ fontSize: "0.82rem", color: "rgba(240,230,211,0.55)" }}>
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
          color: "rgba(240,230,211,0.25)",
          lineHeight: 1.7,
        }}>
          {t.mentionsAcceptation}{" "}
          <Link href="/cgu" style={{ color: "rgba(200,170,110,0.45)" }}>{t.cgu}</Link>
          {" "}{t.et}{" "}
          <Link href="/confidentialite" style={{ color: "rgba(200,170,110,0.45)" }}>{t.politiqueConfidentialite}</Link>.
        </p>
      </div>
    </div>
  );
}
