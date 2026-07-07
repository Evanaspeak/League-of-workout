import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 40%, #0a1220 0%, #040810 70%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            borderRadius: 30,
            border: "4px solid #C8AA6E",
            boxShadow: "0 0 30px rgba(200,170,110,0.35)",
          }}
        >
          <span
            style={{
              color: "#C8AA6E",
              fontSize: 88,
              fontWeight: 800,
              fontFamily: "sans-serif",
              lineHeight: 1,
              textShadow: "0 0 24px rgba(200,170,110,0.5)",
            }}
          >
            W
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
