import { ImageResponse } from "next/og";

export const contentType = "image/png";

/**
 * Icône de l'application installée, aux tailles réclamées par le manifeste.
 *
 * Elle est dessinée plutôt que stockée, pour rester alignée sur la marque
 * sans dupliquer un fichier par taille. Le sigle occupe environ 60 % de la
 * surface : les icônes « maskable » d'Android sont rognées en cercle, et
 * tout ce qui déborde de la zone centrale disparaît.
 */
export function GET(req: Request) {
  const demandee = Number(new URL(req.url).searchParams.get("taille"));
  const taille = [192, 512].includes(demandee) ? demandee : 192;

  const lettre = Math.round(taille * 0.3);
  const barreH = Math.round(taille * 0.26);
  const barreL = Math.max(3, Math.round(taille * 0.05));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0C0E11",
        }}
      >
        <span
          style={{
            color: "#ECEFF4",
            fontSize: lettre,
            fontWeight: 800,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          W
        </span>
        <div style={{ display: "flex", gap: barreL * 0.7, marginLeft: barreL }}>
          <div
            style={{
              width: barreL,
              height: barreH,
              background: "#FF4D2E",
              transform: "skewX(-18deg)",
              borderRadius: 1,
            }}
          />
          <div
            style={{
              width: barreL,
              height: barreH,
              background: "#FFB454",
              transform: "skewX(-18deg)",
              borderRadius: 1,
            }}
          />
        </div>
      </div>
    ),
    { width: taille, height: taille },
  );
}
