import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL  ?? "https://designthathits.com";
const SITE_NAME = "Design That Hits";
const SITE_DESCRIPTION =
  "Print-on-demand gifts, wrapping paper, and party designs. Unique, high-quality designs that make every occasion special.";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

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
    images: [
      {
        url:    OG_IMAGE,
        width:  1200,
        height: 630,
        alt:    `${SITE_NAME} – Unique Print-on-Demand Designs`,
        type:   "image/jpeg",
      },
    ],
  },

  // ── Twitter / X ──────────────────────────────────────────────────────────
  twitter: {
    card:        "summary_large_image",
    site:        "@designthathits",   // ← update to your actual handle if different
    creator:     "@designthathits",
    title:       `${SITE_NAME} – Unique Print-on-Demand Designs`,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, alt: `${SITE_NAME} – Unique Print-on-Demand Designs` }],
  },

  // ── App / PWA ────────────────────────────────────────────────────────────
  applicationName: SITE_NAME,
  category:        "shopping",
  classification:  "E-Commerce, Gifts, Print on Demand",

  // ── Icons ────────────────────────────────────────────────────────────────
  // Place these files in /public:
  //   favicon.ico, icon.png (32×32), apple-icon.png (180×180)
  icons: {
    icon:             [
      { url: "/favicon.ico",         sizes: "any"     },
      { url: "/icon.png",            type: "image/png", sizes: "32x32"   },
      { url: "/icon-192.png",        type: "image/png", sizes: "192x192" },
    ],
    apple:            [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut:         "/favicon.ico",
  },

  // ── Manifest ─────────────────────────────────────────────────────────────
  manifest: "/manifest.json",

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
  themeColor:    [
    { media: "(prefers-color-scheme: light)", color: "#F2E9D8" },
    { media: "(prefers-color-scheme: dark)",  color: "#1A1814" },
  ],
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded focus:px-4 focus:py-2 focus:text-white focus:outline-none"
          style={{ backgroundColor: "var(--orange)" }}
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
