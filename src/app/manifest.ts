import type { MetadataRoute } from "next";

/**
 * Web app manifest, replacing the /manifest.json reference that returned 404 (the browser
 * logged a fetch failure on every page load).
 *
 * Icons point at the app icon files. The paths carry their extensions: these used to be
 * generated routes served at /icon and /apple-icon, and are now `icon.png` and
 * `apple-icon.png` file conventions, where the extensionless path 404s.
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
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
