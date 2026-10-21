# Fonts

Vendored because satori needs real font data at render time, and `next/font/google`
only exposes CSS. `src/app/designs/[slug]/pin-image` reads these with `fs`.

Both are the latin subsets Google Fonts serves, under the SIL Open Font License 1.1,
which permits redistribution as part of a larger work.

| File | Family | Weight | Used for |
|---|---|---|---|
| `playfair-700.ttf` | Playfair Display | 700 | the product name, matching `--font-display` |
| `poppins-600.ttf` | Poppins | 600 | the brand line, matching `--font-body` |

`next.config.js` lists this directory under `outputFileTracingIncludes`. The tracer
cannot see through the `path.join` that reads them, so without that entry they are
absent from the deployed bundle and every pin image 500s.
