import { ImageResponse } from "next/og";
import { textesImageSociale } from "@/lib/i18n/imageSociale";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Win or Workout · Tu perds une game, tu fais des pompes";

/**
 * La carte affichée quand le lien est partagé.
 *
 * C'est la surface la plus vue de tout le site quand on communique sur Reddit
 * ou Discord — et elle portait encore l'ancienne accroche, ponctuée des deux
 * points qu'on venait précisément d'enlever du titre. Elle porte maintenant la
 * même phrase que la page, dit ce que fait le produit, et nomme la plateforme.
 */
export default async function OgImage(
  { params }: { params: Promise<{ locale: string }> },
) {
  const t = textesImageSociale((await params).locale);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "0 84px",
          background: "#0C0E11",
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 82% 100%, rgba(255,77,46,0.16) 0%, rgba(12,14,17,0) 62%)",
        }}
      >
        {/* Marque */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ color: "#ECEFF4", fontSize: 46, fontWeight: 800, fontFamily: "sans-serif", letterSpacing: 3 }}>
            WIN
          </span>
          <div style={{ display: "flex", gap: 7 }}>
            <div style={{ width: 9, height: 40, background: "#FF4D2E", transform: "skewX(-18deg)", borderRadius: 2 }} />
            <div style={{ width: 9, height: 40, background: "#FFB454", transform: "skewX(-18deg)", borderRadius: 2 }} />
          </div>
          <span style={{ color: "#ECEFF4", fontSize: 46, fontWeight: 800, fontFamily: "sans-serif", letterSpacing: 3 }}>
            WORKOUT
          </span>
        </div>

        {/* L'accroche, sur deux lignes et sans point — comme sur la page. */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 46, fontSize: 84, fontFamily: "sans-serif", fontWeight: 800, lineHeight: 1.02, letterSpacing: -1 }}>
          <span style={{ color: "#ECEFF4" }}>{t.accrocheHaut}</span>
          <span style={{ color: "#FF6A38" }}>{t.accrocheBas}</span>
        </div>

        <div style={{ display: "flex", marginTop: 34, fontSize: 27, fontFamily: "sans-serif", color: "#9AA3B0", maxWidth: 900, lineHeight: 1.4 }}>
          {t.sousTitre}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40, fontSize: 20, fontFamily: "monospace", color: "#7F8896", letterSpacing: 2 }}>
          <span style={{ display: "flex", color: "#ECEFF4", background: "#FF4D2E", padding: "10px 20px", borderRadius: 8, letterSpacing: 3, fontWeight: 700 }}>
            {t.badge}
          </span>
          <span style={{ display: "flex" }}>{t.jeux}</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
