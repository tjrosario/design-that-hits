import type { MetadataRoute } from "next";

/**
 * Web app manifest, replacing the /manifest.json reference that returned 404 (the browser
 * logged a fetch failure on every page load).
 *
 * Icons point at the generated app icons rather than files in public/, so there is
 * nothing to keep in sync by hand.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Design That Hits",
    short_name: "DesignThatHits",
    description:
      "Print-on-demand gifts, wrapping paper and party designs that make every occasion special.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E0C0F",
    theme_color: "#0E0C0F",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
