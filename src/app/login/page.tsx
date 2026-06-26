import Link from "next/link";
import { LoginButtons } from "@/components/LoginButtons";

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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; transferred?: string }>;
}) {
  const { error, transferred } = await searchParams;
  const betaFull = error === "AccessDenied";

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
            CONNEXION RÉUSSIE
          </p>
          <p style={{ fontSize: "0.84rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.65 }}>
            Vous êtes connecté dans l&apos;application.<br />Vous pouvez fermer cet onglet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="lol-panel" style={{
        position: "relative",
        padding: "2.5rem 2rem",
        width: "100%", maxWidth: 390,
        textAlign: "center",
        boxShadow: "0 0 90px rgba(200,170,110,0.07), 0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

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
            LEAGUE OF WORKOUTS
          </h1>
          <p style={{
            fontSize: "0.73rem",
            color: "rgba(240,230,211,0.35)",
            letterSpacing: "0.08em",
            marginTop: "0.5rem",
          }}>
            Accès réservé aux beta-testeurs
          </p>
        </div>

        {betaFull ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 6,
              background: "rgba(194,59,34,0.1)",
              border: "1px solid rgba(194,59,34,0.28)",
            }}>
              <p className="loss-text" style={{ fontWeight: 600, marginBottom: "0.3rem" }}>Beta complète</p>
              <p style={{ fontSize: "0.82rem", color: "rgba(240,230,211,0.55)" }}>
                Les 100 places de beta sont déjà prises.
              </p>
            </div>
            <Link href="/waitlist" className="lol-btn" style={{ display: "inline-block" }}>
              Rejoindre la liste d&apos;attente
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
          En vous connectant, vous acceptez nos{" "}
          <Link href="/cgu" style={{ color: "rgba(200,170,110,0.45)" }}>CGU</Link>
          {" "}et notre{" "}
          <Link href="/confidentialite" style={{ color: "rgba(200,170,110,0.45)" }}>politique de confidentialité</Link>.
        </p>
      </div>
    </div>
  );
}
