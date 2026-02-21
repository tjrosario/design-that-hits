"use client";

import Image from "next/image";
import { useState } from "react";
import type { Listing } from "@/types/etsy";

interface ProductCardProps {
  listing: Listing;
  badgeColor?: string;
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

const BADGE_COLORS = [
  '#E8C547', '#7DC4A8', '#E88C6A', '#A8C4E8',
  '#C8A8E8', '#E8A8B8', '#C4D4A0', '#F0C090',
];

export function ProductCard({ listing, badgeColor }: ProductCardProps) {
  const [liked, setLiked] = useState(false);
  const color = badgeColor ?? BADGE_COLORS[listing.id % BADGE_COLORS.length];

  return (
    <article className="product-card flex flex-col">
      {/* Image area */}
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View ${listing.title} on Etsy`}
        className="relative block"
        style={{ backgroundColor: 'var(--cream)', aspectRatio: '1 / 1' }}
      >
        {listing.image ? (
          <Image
            src={listing.image.url}
            alt={listing.image.altText || listing.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: 'var(--sand)' }}>
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Category badge — top left */}
        <span
          className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full leading-none"
          style={{ backgroundColor: color, color: 'var(--ink)' }}
        >
          {badgeTitle(listing.title)}
        </span>

        {/* Heart — top right */}
        <button
          onClick={(e) => { e.preventDefault(); setLiked(!liked); }}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.85)' }}
          aria-label={liked ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={liked}
        >
          <svg
            className="h-3.5 w-3.5"
            fill={liked ? '#E8405A' : 'none'}
            viewBox="0 0 24 24"
            stroke={liked ? '#E8405A' : 'var(--ink-muted)'}
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </a>

      {/* Info */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p
            className="text-sm font-bold line-clamp-1"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', fontSize: '1rem', letterSpacing: '0.01em' }}
          >
            {formatPrice(listing.price, listing.currency)}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink-muted)' }}>
            {listing.title}
          </p>
        </div>
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 ml-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'var(--ink)' }}
          aria-label={`View ${listing.title} on Etsy`}
          tabIndex={0}
        >
          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </a>
      </div>
    </article>
  );
}
