import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <span
          style={{
            color: "#ECEFF4",
            fontSize: 19,
            fontWeight: 800,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          W
        </span>
        <div
          style={{
            display: "flex",
            gap: 2,
            marginLeft: 3,
          }}
        >
          <div
            style={{
              width: 3,
              height: 16,
              background: "#FF4D2E",
              transform: "skewX(-18deg)",
              borderRadius: 1,
            }}
          />
          <div
            style={{
              width: 3,
              height: 16,
              background: "#FFB454",
              transform: "skewX(-18deg)",
              borderRadius: 1,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
