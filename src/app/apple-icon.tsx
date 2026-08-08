import { ImageResponse } from "next/og";

/** Apple touch icon. iOS applies its own corner mask, so this stays square. */
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
          background: "linear-gradient(135deg, #F0417F 0%, #C4155C 100%)",
          color: "#FFFFFF",
          fontSize: 118,
          fontWeight: 700,
          fontFamily: "serif",
        }}
      >
        D
      </div>
    ),
    size
  );
}
