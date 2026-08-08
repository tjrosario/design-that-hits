import { ImageResponse } from "next/og";

/**
 * Stable, square brand logo for Organization structured data.
 *
 * The JSON-LD previously pointed at /icon-192.png, which did not exist, leaving Google
 * with a broken logo for the knowledge panel. The generated app icon has a hashed URL,
 * so this dedicated route exists to give the logo a fixed address that will not change
 * between builds.
 */
export const contentType = "image/png";

export function GET() {
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
          fontSize: 130,
          fontWeight: 700,
          fontFamily: "serif",
        }}
      >
        D
      </div>
    ),
    { width: 192, height: 192 }
  );
}
