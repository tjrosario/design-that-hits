/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        // Below this, controls like the pagination buttons drop their text labels and
        // show only their arrow. 400px covers the 320-390px phones where a full
        // "← Prev" / "Next →" pair plus a position readout will not fit on one line.
        xs: "400px",
      },
      /*
        Point at the same semantic tokens the components use rather than naming the
        families again. next/font generates a hashed family name per build, so a literal
        "Playfair Display" here would silently miss the self-hosted file and fall through
        to Georgia. See the next/font declarations in app/layout.tsx.
      */
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        sans: ["var(--font-body)"],
      },
      /*
        Colours map to the CSS custom properties in globals.css rather than fixed hex
        values. That is what lets a single utility class (`bg-surface`, `text-muted`)
        render correctly in both themes — swapping [data-theme] on <html> changes what
        the variable resolves to, and every utility follows automatically.
      */
      colors: {
        bg: "var(--bg)",
        "bg-elevated": "var(--bg-elevated)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        ink: "var(--text)",
        "ink-soft": "var(--text-soft)",
        "ink-muted": "var(--text-muted)",
        line: "var(--border)",
        "line-soft": "var(--border-soft)",
        brand: "var(--brand)",
        "brand-strong": "var(--brand-strong)",
        "brand-soft": "var(--brand-soft)",
        "brand-ink": "var(--brand-ink)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      backgroundImage: {
        "gradient-brand": "var(--gradient-brand)",
        "gradient-hero": "var(--gradient-hero)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
