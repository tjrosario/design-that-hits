import { ImageResponse } from "next/og";

/**
 * Social share card.
 *
 * Generated rather than committed as a binary. The metadata previously pointed at
 * /og-image.jpg, which did not exist — there was no public/ directory at all — so every
 * share of this site rendered without a preview card. A generated image cannot drift out
 * of sync with the brand or go missing.
 *
 * No web fonts are fetched. Satori would need the font binary at build time, and a
 * network fetch there is a build-time dependency that can fail in CI for a purely
 * cosmetic gain. System serif carries the same editorial tone.
 */
export const alt = "Design That Hits — print-on-demand gifts, wrapping paper and party designs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0E0C0F",
          // Mirrors --gradient-hero: brand glow bleeding in from the right.
          backgroundImage:
            "radial-gradient(ellipse 70% 90% at 100% 30%, rgba(250,60,135,0.42) 0%, rgba(14,12,15,0) 70%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#9E939A",
            marginBottom: 28,
          }}
        >
          Print on demand · Etsy shop
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 92,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#F8F5F7",
            fontFamily: "serif",
          }}
        >
          Designs that hit
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#FA3C87",
            fontFamily: "serif",
            fontStyle: "italic",
          }}
        >
          different.
        </div>

        <div style={{ display: "flex", marginTop: 44, alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", width: 56, height: 6, background: "#FA3C87", borderRadius: 3 }} />
          <div style={{ display: "flex", fontSize: 30, color: "#C7BCC2" }}>designthathits.com</div>
        </div>
      </div>
    ),
    size
  );
}
