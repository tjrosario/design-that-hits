/**
 * The shop's profiles elsewhere.
 *
 * One list feeds both the Organization `sameAs` in the home page's structured data and the
 * visible links in the footer. Google treats `sameAs` as a claim about which accounts are
 * the same entity, and corroborates it against links the site actually renders, so the two
 * drifting apart weakens the signal they exist to send.
 */
export interface SocialProfile {
  label: string;
  url: string;
}

export const SOCIAL_PROFILES: SocialProfile[] = [
  { label: "Etsy", url: "https://designthathits.etsy.com" },
  // Trailing slash is Pinterest's canonical form; the bare path 301s to it, and a
  // redirect in `sameAs` is a weaker claim than the URL it lands on.
  { label: "Pinterest", url: "https://www.pinterest.com/designthathits/" },
  { label: "Instagram", url: "https://www.instagram.com/designthathits" },
  { label: "TikTok", url: "https://www.tiktok.com/@design.that.hits" },
];

/** Just the URLs, in the order above, for schema.org `sameAs`. */
export const SOCIAL_URLS = SOCIAL_PROFILES.map((p) => p.url);
