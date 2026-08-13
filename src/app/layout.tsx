import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeScript } from "@/components/ThemeScript";
import { Playfair_Display, Poppins } from "next/font/google";

/*
  SELF-HOSTED WEBFONTS

  These used to load through `@import url('https://fonts.googleapis.com/…')` at the top of
  globals.css, which is about the slowest way to deliver a font. That built a four-level
  request chain — HTML, then globals.css, then Google's 17.5KB stylesheet, then the twelve
  font files — so the browser could not discover a single font until the app's own
  stylesheet had downloaded and parsed, and then had to reach a third-party origin with
  its own DNS lookup and TLS handshake to get them.

  next/font downloads the files at build time and serves them from our own origin.

  Declared HERE rather than in a separate module on purpose: Next attaches the <link
  rel="preload"> hints based on the file where the font function is called, and only a
  call in the root layout preloads across every route. Moved into a separate module, everything
  still worked but no preload tag was emitted.
*/
/**
 * Display face: headings, the logo, prices.
 *
 * No `weight` because Playfair Display ships as a variable font — one file covers the
 * whole 400–900 axis. That is both fewer bytes than the seven static cuts the old
 * @import pulled, and a correctness fix: the old list stopped at 800, so the seventeen
 * `font-black` (900) headings across the app were silently rendering at 800, and the
 * italic logo at 700.
 */
const fontDisplay = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-playfair",
});

/**
 * Body face.
 *
 * Poppins has no variable cut, so the weights are listed explicitly. Only the four the
 * app actually uses are here: the old @import also fetched 300, which nothing renders.
 * 900 is deliberately absent — every `font-black` in the codebase is paired with the
 * display face, never this one.
 */
const fontBody = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL  ?? "https://designthathits.com";
const SITE_NAME = "Design That Hits";
const SITE_DESCRIPTION =
  "Print-on-demand gifts, wrapping paper, and party designs. Unique, high-quality designs that make every occasion special.";

export const metadata: Metadata = {
  // ── Core ────────────────────────────────────────────────────────────────────
  metadataBase: new URL(SITE_URL),
  title: {
    default:  `${SITE_NAME} – Unique Print-on-Demand Designs`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "print on demand",
    "gift wrapping paper",
    "party designs",
    "custom gifts",
    "etsy shop",
    "unique gifts",
    "birthday wrapping paper",
    "personalized party supplies",
    "design that hits",
  ],
  authors:   [{ name: "Design That Hits", url: SITE_URL }],
  creator:   "Design That Hits",
  publisher: "Design That Hits",

  // ── Canonical & alternates ───────────────────────────────────────────────
  alternates: {
    canonical: SITE_URL,
    languages: { "en-US": SITE_URL },
  },

  // ── Robots ───────────────────────────────────────────────────────────────
  robots: {
    index:              true,
    follow:             true,
    nocache:            false,
    googleBot: {
      index:              true,
      follow:             true,
      noimageindex:       false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet":       -1,
    },
  },

  // ── Open Graph ───────────────────────────────────────────────────────────
  openGraph: {
    type:        "website",
    locale:      "en_US",
    url:         SITE_URL,
    siteName:    SITE_NAME,
    title:       `${SITE_NAME} – Unique Print-on-Demand Designs`,
    description: SITE_DESCRIPTION,
  },

  // ── Twitter / X ──────────────────────────────────────────────────────────
  twitter: {
    card:        "summary_large_image",
    site:        "@designthathits",   // ← update to your actual handle if different
    creator:     "@designthathits",
    title:       `${SITE_NAME} – Unique Print-on-Demand Designs`,
    description: SITE_DESCRIPTION,
  },

  // ── App / PWA ────────────────────────────────────────────────────────────
  applicationName: SITE_NAME,
  category:        "shopping",
  classification:  "E-Commerce, Gifts, Print on Demand",

  // ── Icons and manifest ───────────────────────────────────────────────────
  // Deliberately not declared here. app/icon.tsx, app/apple-icon.tsx and
  // app/manifest.ts generate them and Next emits the tags automatically. The previous
  // hand-written entries pointed at /favicon.ico, /icon.png, /icon-192.png,
  // /apple-icon.png and /manifest.json — none of which existed, because the project has
  // no public/ directory. Every one returned 404.

  // ── Site verification ─────────────────────────────────────────────────────
  // Add your real tokens from each platform's Search Console / Webmaster Tools.
  // Remove any line where you don't have a token yet.
  verification: {
    google:  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION  ?? "",
    yandex:  process.env.NEXT_PUBLIC_YANDEX_VERIFICATION       ?? "",
    // bing / other: add via <meta name="msvalidate.01"> in the `other` field below
  },

  // ── Other / custom meta tags ─────────────────────────────────────────────
  other: {
    // Bing / Microsoft
    "msvalidate.01":          process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? "",
    // Pinterest domain verification
    "p:domain_verify":        process.env.NEXT_PUBLIC_PINTEREST_VERIFICATION ?? "",
    // Referrer policy
    "referrer":               "origin-when-cross-origin",
    // Mobile web-app
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": SITE_NAME,
    // Format detection — prevent iOS auto-linking phone numbers / addresses
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  width:         "device-width",
  initialScale:  1,
  maximumScale:  5,
  // Matches the two theme backgrounds so the mobile browser chrome blends in.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8FB" },
    { media: "(prefers-color-scheme: dark)", color: "#121013" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required and narrow in scope: ThemeScript sets
    // data-theme on this element before React hydrates, so the attribute legitimately
    // differs from what the server rendered. It suppresses the warning for <html>'s own
    // attributes only, not for any content inside.
    // The two font classes only declare --font-playfair and --font-poppins; globals.css
    // composes them into --font-display and --font-body. They sit on <html> so the
    // variables are in scope for everything, including portalled overlays.
    <html
      lang="en"
      data-theme="dark"
      className={`${fontDisplay.variable} ${fontBody.variable}`}
      suppressHydrationWarning
    >
      {/* In <head> deliberately: the theme attribute has to be set during HTML parsing,
          before the first paint, or light-theme visitors see a dark flash. */}
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded focus:px-4 focus:py-2 focus:outline-none"
          style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
