import Link from "next/link";

export const metadata = { title: "Téléchargement — League of Workouts" };

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? null;

export default function TelechargementPage() {
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
          boxShadow: "0 0 80px rgba(200,170,110,0.07), 0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

        <div style={{ fontSize: "2.8rem", marginBottom: "1rem" }}>🖥️</div>

        <h1
          style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "1.1rem",
            color: "#C8AA6E",
            letterSpacing: "0.16em",
            marginBottom: "0.5rem",
          }}
        >
          APPLICATION DESKTOP
        </h1>

        <p
          style={{
            fontSize: "0.82rem",
            color: "rgba(240,230,211,0.45)",
            marginBottom: "2rem",
            lineHeight: 1.7,
          }}
        >
          Intègre le client League of Legends en temps réel.<br />
          Compatible Windows 10 / 11.
        </p>

        {DOWNLOAD_URL ? (
          <a
            href={DOWNLOAD_URL}
            className="lol-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}
          >
            ⬇ Télécharger pour Windows
          </a>
        ) : (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: 6,
              background: "rgba(200,170,110,0.05)",
              border: "1px solid rgba(200,170,110,0.15)",
              fontSize: "0.85rem",
              color: "rgba(240,230,211,0.5)",
              lineHeight: 1.7,
            }}
          >
            Bientôt disponible — le lien de téléchargement sera ajouté ici dès la sortie.
          </div>
        )}

        <div
          style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(200,170,110,0.08)",
            fontSize: "0.75rem",
            color: "rgba(240,230,211,0.3)",
            lineHeight: 1.8,
            textAlign: "left",
          }}
        >
          <p style={{ fontWeight: 600, color: "rgba(240,230,211,0.45)", marginBottom: "0.5rem" }}>
            Comment ça fonctionne ?
          </p>
          <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <li>Installez l&apos;application sur votre PC Windows.</li>
            <li>Connectez-vous avec votre compte League of Workouts.</li>
            <li>Lancez une partie — l&apos;application détecte automatiquement les résultats.</li>
            <li>Les pompes s&apos;accumulent en temps réel sans intervention manuelle.</li>
          </ul>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <Link
            href="/dashboard"
            style={{ fontSize: "0.78rem", color: "rgba(200,170,110,0.45)", textDecoration: "none" }}
          >
            ← Retour au dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const s: React.CSSProperties = {
    position: "absolute",
    width: 18,
    height: 18,
    ...(pos === "tl" && { top: 0, left: 0, borderTop: "2px solid #C8AA6E", borderLeft: "2px solid #C8AA6E" }),
    ...(pos === "tr" && { top: 0, right: 0, borderTop: "2px solid #C8AA6E", borderRight: "2px solid #C8AA6E" }),
    ...(pos === "bl" && { bottom: 0, left: 0, borderBottom: "2px solid #C8AA6E", borderLeft: "2px solid #C8AA6E" }),
    ...(pos === "br" && { bottom: 0, right: 0, borderBottom: "2px solid #C8AA6E", borderRight: "2px solid #C8AA6E" }),
  };
  return <span style={s} />;
}
