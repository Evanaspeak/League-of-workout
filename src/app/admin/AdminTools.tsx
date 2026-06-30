"use client";

export default function AdminTools() {
  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      <h2 style={{
        fontFamily: "var(--font-heading)",
        fontSize: "1rem",
        color: "#C8AA6E",
        letterSpacing: "0.1em",
        marginBottom: 16,
      }}>
        OUTILS ADMIN
      </h2>
      <button
        onClick={() => {
          localStorage.removeItem("low_onboarded");
          localStorage.removeItem("splash");
          window.location.href = "/dashboard";
        }}
        style={{
          padding: "8px 18px",
          borderRadius: 6,
          fontSize: "0.82rem",
          cursor: "pointer",
          background: "transparent",
          border: "1px dashed rgba(200,170,110,0.3)",
          color: "rgba(200,170,110,0.6)",
          letterSpacing: "0.06em",
        }}
      >
        ↺ Rejouer l&apos;intro (splash + onboarding)
      </button>
    </div>
  );
}
