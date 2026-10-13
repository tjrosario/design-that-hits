/**
 * The two site-wide JSON-LD nodes, rendered from the root layout.
 *
 * They used to live on the home page only, while every other page declared
 * `isPartOf` or `publisher` pointing at their `@id`. That left the brand entity
 * unresolvable on 520 of 523 URLs: a reference to an `@id` that is nowhere on the page
 * is a dangling reference, so the name, logo, profile links and contact point reached
 * exactly one URL.
 *
 * No `SearchAction` here. Google retired the sitelinks search box in November 2024, so
 * the node it fed does nothing, and the site's search results are noindex anyway.
 */

import { SOCIAL_URLS } from "@/lib/social";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: "Design That Hits",
      url: SITE_URL,
      description: "Print-on-demand gifts, wrapping paper, and party designs for every occasion.",
      inLanguage: "en-US",
      publisher: { "@id": ORGANIZATION_ID },
    },
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "Design That Hits",
      url: SITE_URL,
      // Served by src/app/brand-logo.png/route.tsx, not from a public/ directory.
      logo: { "@type": "ImageObject", url: `${SITE_URL}/brand-logo.png`, width: 192, height: 192 },
      sameAs: SOCIAL_URLS,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: "hello@designthathits.com",
        availableLanguage: "English",
      },
    },
  ],
};
