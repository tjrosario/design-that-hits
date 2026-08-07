/**
 * components/ThemeScript.tsx
 *
 * Applies the saved theme to <html> before the browser paints anything.
 *
 * WHY A SCRIPT AND NOT REACT STATE:
 * The server cannot know which theme a visitor chose — that lives in their localStorage.
 * Applying it in an effect would paint the default theme first and then snap to the
 * chosen one: the classic flash of wrong theme. A synchronous script in <head> sets the
 * attribute during HTML parsing, before first paint.
 *
 * WHY A RAW <script> AND NOT next/script:
 * `next/script` with strategy="beforeInteractive" looks like the right tool, and the App
 * Router docs point at it, but it does not emit an inline script. It serialises the body
 * into a `self.__next_s` queue that Next's own deferred bundle executes later — after
 * first paint. Measured on this app: the queue entry lands at byte ~5.4k of the HTML but
 * only runs once the framework bundle boots, which would give every light-theme visitor
 * a dark flash on load. A raw inline tag is the only thing that runs during parse, which
 * is why every theming library does it this way.
 *
 * React logs a dev-only advisory that "scripts inside React components are never
 * executed when rendering on the client". That is accurate and harmless here: this only
 * ever needs to run on the initial document load, never during client-side navigation.
 * The same advisory covers components/JsonLd.tsx, which emits structured-data scripts
 * for the same server-only reason.
 *
 * The script body is a fixed string with no interpolation of user or request data, so
 * there is nothing here to inject into.
 *
 * Dark is the default, per the design direction. A visitor who has never chosen gets
 * dark regardless of their OS setting; once they pick, their choice wins everywhere.
 */

export const THEME_STORAGE_KEY = "dth-theme";

const script = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    // Anything other than an explicit 'light' resolves to dark, so a corrupted or
    // unexpected value fails safe to the design's default rather than throwing.
    document.documentElement.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
