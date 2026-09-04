const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin Turbopack's workspace root to this project. Without it, Turbopack walks up the
  // tree, finds the stray package.json/package-lock.json in the parent workspace
  // directory, and warns on every dev start. Pinning also keeps module resolution
  // deterministic regardless of where the repo is checked out.
  turbopack: {
    root: __dirname,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.etsystatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.etsystatic.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      /*
        Let the CDN cache the home page.

        `/` is the only route on the site that renders dynamically. It has to: the filter
        state lives in the query string, and generateMetadata reads it to decide the
        canonical and robots directives per URL. Reading searchParams opts the whole route
        into dynamic rendering, and Next then sends `Cache-Control: private, no-cache,
        no-store`, so the most important and most linked page on the site was the one page
        that could never be served from cache. Every visit, Googlebot included, paid a
        function invocation while every other route came off the edge in a few ms.

        Nothing about the response is per-visitor. There is no auth, no session, and the
        theme is applied by an inline script from localStorage rather than server-rendered,
        so a shared cache entry is safe. The CDN keys on the full URL, so filtered and
        paginated variants cache independently of the plain home page.

        `max-age=0` keeps browsers revalidating, so a person always sees current stock.
        `s-maxage=300` is the shared-cache window, chosen to sit inside the 15 minute RSS
        overlay window so new arrivals still surface on their usual schedule.
      */
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
