import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Win or Workout — Gagne ta game, ou paie en pompes";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0C0E11",
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 12% 0%, rgba(157,124,255,0.16) 0%, rgba(12,14,17,0) 60%)," +
            "radial-gradient(ellipse 55% 45% at 92% 100%, rgba(255,77,46,0.15) 0%, rgba(12,14,17,0) 58%)",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <span style={{ color: "#ECEFF4", fontSize: 110, fontWeight: 800, fontFamily: "sans-serif", letterSpacing: 4 }}>
            WIN
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 16, height: 96, background: "#FF4D2E", transform: "skewX(-18deg)", borderRadius: 4 }} />
            <div style={{ width: 16, height: 96, background: "#FFB454", transform: "skewX(-18deg)", borderRadius: 4 }} />
          </div>
          <span style={{ color: "#ECEFF4", fontSize: 110, fontWeight: 800, fontFamily: "sans-serif", letterSpacing: 4 }}>
            WORKOUT
          </span>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", gap: 14, marginTop: 44, fontSize: 34, fontFamily: "sans-serif", fontWeight: 600 }}>
          <span style={{ color: "#ECEFF4" }}>Gagne ta game.</span>
          <span style={{ color: "#FF6A38" }}>Ou paie en pompes.</span>
        </div>

        {/* Jeux */}
        <div style={{ display: "flex", marginTop: 34, fontSize: 19, fontFamily: "monospace", color: "#98A2B0", letterSpacing: 3 }}>
          LEAGUE OF LEGENDS · VALORANT · FORTNITE · COD
        </div>
      </div>
    ),
    { ...size }
  );
}
