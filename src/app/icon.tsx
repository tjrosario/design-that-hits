import { ImageResponse } from "next/og";

/**
 * App icon, replacing the /favicon.ico and /icon.png references that returned 404.
 * Generated at build time so it can never go missing or fall out of step with the brand.
 */
export const size = { width: 64, height: 64 };
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
          background: "linear-gradient(135deg, #F0417F 0%, #C4155C 100%)",
          color: "#FFFFFF",
          fontSize: 42,
          fontWeight: 700,
          fontFamily: "serif",
          borderRadius: 14,
        }}
      >
        D
      </div>
    ),
    size
  );
}
