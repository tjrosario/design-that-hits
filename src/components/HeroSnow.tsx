import type { CSSProperties } from "react";

/**
 * Snow drifting across the hero while Christmas is being promoted.
 *
 * Every position and timing is derived from the index rather than from `Math.random`, so
 * the server and the browser emit identical markup and there is nothing to hydrate
 * around. Negative delays start each flake part-way down, so the hero is already snowing
 * on the first frame instead of filling from an empty sky.
 *
 * No JavaScript runs after this renders: the motion is a CSS animation on a transform,
 * which the compositor handles without the main thread. See `.hero-snow` in globals.css
 * for the sizing, the reduced-motion rule and the phone cut.
 */
const FLAKES = Array.from({ length: 18 }, (_, i) => ({
  "--x": `${(i * 37 + 5) % 100}%`,
  "--size": `${10 + ((i * 7) % 4) * 4}px`,
  "--duration": `${12 + ((i * 5) % 7) * 1.6}s`,
  "--delay": `${-((i * 13) % 19)}s`,
  "--drift": `${((i % 5) - 2) * 36}px`,
  "--spin": `${(i % 2 ? 1 : -1) * (180 + (i % 3) * 90)}deg`,
  "--fade": `${0.45 + ((i * 3) % 5) * 0.11}`,
}));

export function HeroSnow() {
  return (
    <div aria-hidden="true" className="hero-snow pointer-events-none absolute inset-0 overflow-hidden">
      {FLAKES.map((style, i) => (
        <span key={i} style={style as CSSProperties} />
      ))}
    </div>
  );
}
