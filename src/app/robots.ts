import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/*
  Every crawler is allowed, including the AI ones.

  This used to block GPTBot, ChatGPT-User, CCBot, anthropic-ai and Claude-Web. The block
  cost more than it protected: assistants are now a real discovery path for handmade and
  print-on-demand goods, and a shop they cannot read is a shop they cannot recommend.
  The listing copy and images are already public on Etsy, so withholding them here kept
  nothing private.

  /api/ stays disallowed. Those routes return JSON that duplicates what the pages already
  render, so crawling them only spends budget on content with no landing page.

  /studio is deliberately NOT listed here. robots.txt is public and is the first place
  anyone looks for unlinked paths, so a Disallow line would advertise it. Worse, the two
  defeat each other: a crawler that obeys Disallow never fetches the page and so never
  reads its noindex, which is what lets a URL discovered elsewhere get indexed bare. The
  noindex on the route is the control; keeping the path out of this file is the privacy.
*/
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     "/",
        disallow:  ["/api/"],
      },
    ],
    sitemap:  `${SITE_URL}/sitemap.xml`,
    host:     SITE_URL,
  };
}
