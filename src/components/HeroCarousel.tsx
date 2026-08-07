"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Listing } from "@/types/etsy";

interface HeroCarouselProps {
  listings: Listing[];
  /** Milliseconds each product stays fully visible before the next fades in. */
  intervalMs?: number;
}

/**
 * Cross-fading product showcase for the hero.
 *
 * HYDRATION SAFETY:
 * Every random choice happens inside the interval callback, never during render and
 * never synchronously on mount. The server and the first client render both show index
 * 0, so there is nothing for React to disagree about; the shuffling only begins on the
 * first tick. This also satisfies React 19's rule against setState inside an effect body.
 *
 * MOTION:
 * The transition is opacity only — no movement. That keeps it appropriate under
 * prefers-reduced-motion, where the concern is motion rather than a change of image,
 * and it means the browser can composite the whole thing on the GPU.
 */
export function HeroCarousel({ listings, intervalMs = 4200 }: HeroCarouselProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (listings.length < 2) return;

    const timer = setInterval(() => {
      // Skip advancing while the tab is hidden: the fades would queue up unseen and the
      // carousel would lurch through several products the moment it regains focus.
      if (document.visibilityState !== "visible") return;

      setActive((current) => {
        // Pick a random other product rather than cycling in order. Choosing from the
        // remaining n-1 and stepping over the current index guarantees the same image
        // never repeats back-to-back, which a naive random pick would do regularly.
        let next = Math.floor(Math.random() * (listings.length - 1));
        if (next >= current) next++;
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [listings.length, intervalMs]);

  if (listings.length === 0) return null;

  return (
    // hero-carousel carries the left-edge mask; see globals.css.
    <div className="hero-carousel absolute inset-0" aria-hidden="true">
      {listings.map((listing, slot) => {
        if (!listing?.image) return null;
        const isActive = slot === active;

        return (
          <div
            key={listing.id}
            className="hero-slide"
            style={{ opacity: isActive ? 1 : 0 }}
          >
            <Image
              src={listing.image.url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 45vw"
              className="object-cover"
              // Only the first slide is worth preloading; the rest are revealed over
              // several seconds and would otherwise compete with the real content.
              priority={slot === 0}
            />
          </div>
        );
      })}
    </div>
  );
}
