import { pinItUrl } from "@/lib/pinterest";
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
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-3.65 19.31c-.09-.78-.17-1.98.03-2.83.18-.77 1.19-4.94 1.19-4.94s-.3-.6-.3-1.5c0-1.4.82-2.45 1.83-2.45.86 0 1.28.65 1.28 1.42 0 .87-.55 2.17-.84 3.37-.24 1.01.5 1.84 1.5 1.84 1.8 0 3.19-1.9 3.19-4.65 0-2.43-1.75-4.13-4.24-4.13-2.89 0-4.59 2.17-4.59 4.4 0 .88.34 1.81.76 2.32a.3.3 0 0 1 .07.29l-.28 1.15c-.05.18-.15.22-.34.13-1.25-.58-2.03-2.4-2.03-3.87 0-3.15 2.29-6.04 6.6-6.04 3.47 0 6.16 2.47 6.16 5.77 0 3.45-2.17 6.22-5.19 6.22-1.01 0-1.96-.53-2.29-1.15l-.62 2.38c-.23.86-.84 1.94-1.26 2.6A10 10 0 1 0 12 2z" />
      </svg>
      Save to Pinterest
    </a>
  );
}
