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
          background: "#0C0E11",
        }}
      >
        <span
          style={{
            color: "#ECEFF4",
            fontSize: 104,
            fontWeight: 800,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          W
        </span>
        <div
          style={{
            width: 20,
            height: 94,
            background: "#FF4D2E",
            transform: "skewX(-18deg)",
            borderRadius: 4,
            marginLeft: 14,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
