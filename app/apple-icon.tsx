import { ImageResponse } from "next/og.js";

// Apple touch icon — same mark as app/icon.svg (white L + emerald dot on
// a hairline-bordered black tile) as a PNG for clients that need one.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0b",
        border: "2px solid #27272a",
        borderRadius: 40,
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", color: "#fafafa", fontSize: 96 }}>
        L
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: "#34d399",
            marginLeft: 8,
            marginBottom: 12,
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
