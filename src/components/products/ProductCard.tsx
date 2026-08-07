"use client";

import Image from "next/image";
// import { useState } from "react"; // re-enable with the favourite button below
import type { Listing } from "@/types/etsy";

interface ProductCardProps {
  listing: Listing;
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

// Truncate title to ~20 chars for the badge
function badgeTitle(title: string): string {
  const words = title.split(" ");
  let out = "";
  for (const w of words) {
    if ((out + " " + w).trim().length > 18) break;
    out = (out + " " + w).trim();
  }
  return out || title.slice(0, 16);
}

export function ProductCard({ listing }: ProductCardProps) {
  // Favourite button is parked for now — see the commented block below. It was purely
  // local state with nothing persisting it, so nothing is lost by disabling it.
  // const [liked, setLiked] = useState(false);

  return (
    // Hover styling is driven by .product-zone on the parent <li>, not by this element,
    // so the trigger box stays still while the card lifts. See globals.css.
    <article className="product-card flex flex-col">
      {/*
        Image area.

        The link is a stretched overlay rather than a wrapper. Nesting the favourite
        <button> inside an <a> is invalid HTML (interactive content cannot descend from
        an anchor) and gives assistive tech two overlapping controls with no way to
        reach the inner one predictably. Keeping them siblings and layering with
        z-index preserves the "whole image is clickable" behaviour without the nesting.
      */}
      <div
        className="relative block overflow-hidden"
        style={{ backgroundColor: 'var(--bg)', aspectRatio: '1 / 1' }}
      >
        {listing.image ? (
          <Image
            src={listing.image.url}
            alt={listing.image.altText || listing.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover product-image"
            priority={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: 'var(--border)' }}>
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Stretched link — sits above the image, below the badge and heart */}
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${listing.title} on Etsy`}
          className="absolute inset-0 z-10"
        />

        {/* Category badge — top left */}
        <span
          className="absolute top-2.5 left-2.5 z-20 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full leading-none pointer-events-none backdrop-blur-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg) 72%, transparent)",
            color: "var(--text-soft)",
            border: "1px solid var(--border-soft)",
          }}
        >
          {badgeTitle(listing.title)}
        </span>

        {/*
          Favourite button — disabled for now.

          To restore: uncomment this block and the useState/import at the top of the file.
          Note it only ever held local state, so a "like" vanished on reload; if it comes
          back it should persist somewhere.

        <button
          onClick={() => setLiked(!liked)}
          className="absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
          style={{
            background: liked ? "var(--gradient-brand)" : "color-mix(in srgb, var(--bg) 72%, transparent)",
            border: "1px solid var(--border-soft)",
            color: liked ? "var(--brand-ink)" : "var(--text-soft)",
          }}
          aria-label={liked ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={liked}
        >
          <svg
            className="h-3.5 w-3.5"
            fill={liked ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        */}
      </div>

      {/* Info */}
      <div className="px-3.5 py-3 sm:px-4">
        <p
          className="text-xs sm:text-[0.8125rem] leading-snug line-clamp-2 mb-2"
          style={{ color: "var(--text-soft)" }}
          title={listing.title}
        >
          {listing.title}
        </p>

        <div className="flex items-center justify-between gap-3">
          <p
            className="text-base sm:text-lg leading-none"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            {formatPrice(listing.price, listing.currency)}
          </p>

          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card-action"
            aria-label={`View ${listing.title} on Etsy`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}
