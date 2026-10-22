import { pinItUrl } from "@/lib/pinterest";
import { PinterestMark } from "@/components/icons/PinterestMark";
import type { Listing } from "@/types/etsy";

/**
 * The save action on a product page.
 *
 * A plain anchor to Pinterest's compose URL rather than their widget script: no
 * third-party JavaScript, nothing to hydrate, and it works with the bundle blocked.
 * Renders nothing for a listing with no photo, since there would be nothing to pin.
 *
 * `rel="nofollow"` because this is a user action, not an endorsement of the destination.
 */
export function SaveToPinterest({ listing }: { listing: Listing }) {
  const href = pinItUrl(listing);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener noreferrer"
      className="btn-outline"
      data-testid="save-to-pinterest"
    >
      <PinterestMark />
      Save to Pinterest
    </a>
  );
}
