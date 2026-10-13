"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Listing } from "@/types/etsy";
import { fullSizeImageUrl } from "@/lib/images";

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
  /*
    Which slides have been mounted. All of them live inside the visible hero at opacity 0,
    so `loading="lazy"` cannot defer them: the browser fetches every one on load. Mounting
    only what has actually been shown keeps the initial cost to a single image instead of
    eight full-resolution ones.
  */
  const [shown, setShown] = useState<number[]>([0]);
  // Read inside the interval so the callback does not have to close over `active`, which
  // would mean tearing down and rebuilding the timer on every slide.
  const activeRef = useRef(0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (listings.length < 2) return;

    const timer = setInterval(() => {
      // Skip advancing while the tab is hidden: the fades would queue up unseen and the
      // carousel would lurch through several products the moment it regains focus.
      if (document.visibilityState !== "visible") return;

      // Pick a random other product rather than cycling in order. Choosing from the
      // remaining n-1 and stepping over the current index guarantees the same image
      // never repeats back-to-back, which a naive random pick would do regularly.
      const current = activeRef.current;
      let next = Math.floor(Math.random() * (listings.length - 1));
      if (next >= current) next++;

      // Both updates happen here rather than inside an updater: React 19 may invoke an
      // updater twice, so it has to stay pure.
      setActive(next);
      setShown((seen) => (seen.includes(next) ? seen : [...seen, next]));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [listings.length, intervalMs]);

  if (listings.length === 0) return null;

  return (
    // hero-carousel carries the left-edge mask; see globals.css.
    <div className="hero-carousel absolute inset-0" aria-hidden="true">
      {listings.map((listing, slot) => {
        if (!listing?.image || !shown.includes(slot)) return null;
        const isActive = slot === active;

        return (
          <div
            key={listing.id}
            className="hero-slide"
            style={{ opacity: isActive ? 1 : 0 }}
          >
            <Image
              // The stored URL is Etsy's thumbnail variant on about a quarter of the
              // catalog, which `fill` then stretches across the slot.
              src={fullSizeImageUrl(listing.image.url)}
              alt=""
              fill
              /*
                A constant, because `object-cover` makes the requirement height-driven
                rather than width-driven. The flex container has `md:min-h-[520px]` and
                the image box is `inset-y-0`, so the bitmap has to be at least
                height x source aspect wide. Most of these sources are 2754x1536, so
                520 x 1.79 is about 930, and a taller container needs more; the slot is
                only ~770 wide, so sizing to the slot width leaves it upscaled.
              */
              sizes="(max-width: 768px) 100vw, 1100px"
              className="object-cover"
              // A large detailed product shot, so a little more than the grid's 75.
              // Must stay inside `images.qualities` in next.config.js or it 400s.
              quality={85}
            />
          </div>
        );
      })}
    </div>
  );
}
