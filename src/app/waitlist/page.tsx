import Link from "next/link";

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

export default function WaitlistPage() {
  return (
    <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="lol-panel" style={{
        position: "relative",
        padding: "2.5rem 2rem",
        width: "100%", maxWidth: 380,
        textAlign: "center",
        boxShadow: "0 0 80px rgba(200,170,110,0.06), 0 20px 60px rgba(0,0,0,0.35)",
      }}>
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

        <div style={{ fontSize: "2rem", marginBottom: "1rem", color: "rgba(200,170,110,0.6)" }}>⏳</div>
        <h1 style={{
          fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
          fontSize: "1.05rem",
          color: "#C8AA6E",
          letterSpacing: "0.15em",
          marginBottom: "1.25rem",
        }}>
          LISTE D&apos;ATTENTE
        </h1>
        <p style={{ fontSize: "0.84rem", color: "rgba(240,230,211,0.6)", lineHeight: 1.7, marginBottom: "1.75rem" }}>
          La beta est limitée à 100 testeurs et toutes les places sont prises.
          Une prochaine vague d&apos;accès est prévue — reviens bientôt&nbsp;!
        </p>
        <Link href="/login" className="lol-btn" style={{ display: "inline-block" }}>
          Retour
        </Link>
      </div>
    </div>
  );
}
