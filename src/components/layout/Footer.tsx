import Link from "next/link";
import { SOCIAL_PROFILES } from "@/lib/social";

/** Brand glyphs for the footer profile links. Decorative: the <a> carries the label. */
function SocialIcon({ label }: { label: string }) {
  const common = { className: "h-4 w-4", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;

  if (label === "Instagram") {
    return (
      <svg {...common}>
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 5.68a4.16 4.16 0 1 0 0 8.32 4.16 4.16 0 0 0 0-8.32Zm0 6.86a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm5.3-7.02a.97.97 0 1 1-1.94 0 .97.97 0 0 1 1.94 0Z" />
      </svg>
    );
  }
  if (label === "TikTok") {
    return (
      <svg {...common}>
        <path d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.1v11.6a2.45 2.45 0 0 1-2.45 2.4 2.45 2.45 0 1 1 .72-4.79V9.03a5.53 5.53 0 1 0 4.83 5.49V8.9a7.35 7.35 0 0 0 4.3 1.38V7.18a4.3 4.3 0 0 1-3.24-1.36Z" />
      </svg>
    );
  }
  // Etsy has no common glyph, so its mark is the wordmark letter.
  return (
    <span className="text-[13px] font-bold leading-none" aria-hidden="true">
      E
    </span>
  );
}

export function Footer() {
  return (
    <footer className="mt-8 border-t" style={{ borderColor: 'var(--border-soft)', backgroundColor: 'var(--bg-elevated)' }}>
      <div className="mx-auto max-w-screen-xl px-4 sm:px-5 py-10 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <p
              className="text-xl mb-3"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text)' }}
            >
              Design<span style={{ color: 'var(--brand)', fontStyle: 'italic' }}>That</span>Hits
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Print-on-demand gifts, wrapping paper & party designs for every occasion.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-4 block">
              Navigate
            </p>
            <ul className="space-y-2">
              {[{ href: '/', l: 'Shop' }, { href: '/collections', l: 'Collections' }, { href: '/about', l: 'About us' }, { href: '/contact', l: 'Contact' }].map(({ href, l }) => (
                <li key={href}>
                  <Link href={href} className="text-sm font-medium transition-colors hover:underline" style={{ color: 'var(--text-soft)' }}>
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-4 block">
              Stay Connected
            </p>
            {/* rel="me" is the identity marker for these links, and it is what corroborates
                the Organization sameAs list in the home page's structured data. */}
            <ul className="flex items-center gap-3 mb-5">
              {SOCIAL_PROFILES.map(({ label, url }) => (
                <li key={label}>
                  <a
                    href={url}
                    target="_blank"
                    rel="me noopener noreferrer"
                    aria-label={`Design That Hits on ${label}`}
                    className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-75"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', color: 'var(--text-soft)' }}
                  >
                    <SocialIcon label={label} />
                  </a>
                </li>
              ))}
            </ul>

            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Updates & new arrivals in your inbox</p>
            <div className="flex gap-2">
              {/*
                Password managers inject an icon element next to any field they take for a
                login, and this newsletter box qualifies. That injected node lands in the
                DOM before React hydrates, so React finds a child it never rendered and
                throws a hydration mismatch.

                Two defences, because one is not enough:

                1. The opt-out attributes below. Each vendor documents its own, and they
                   stop the injection at the source. That is the actual fix.
                2. The wrapper div. suppressHydrationWarning on it only covers attributes
                   and text — it does NOT excuse an unexpected child element — so it is
                   not a fix on its own. What the wrapper does buy is containment: if some
                   other extension injects anyway, the node lands here instead of between
                   the input and the Subscribe button, where it used to displace the
                   button and break the layout as well as hydration.
              */}
              <div className="flex-1 min-w-0" suppressHydrationWarning>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="w-full rounded-full px-4 py-2 text-xs focus:outline-none font-medium"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-soft)' }}
                  aria-label="Email for newsletter"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore=""
                  data-bwignore="true"
                  data-form-type="other"
                  suppressHydrationWarning
                />
              </div>
              <button
                className="rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-85"
                style={{ background: 'var(--gradient-brand)', color: 'var(--brand-ink)' }}
                aria-label="Subscribe"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Design That Hits. All rights reserved.
          </p>
          <a
            href="https://designthathits.etsy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold"
            style={{ color: 'var(--brand)' }}
          >
            designthathits.etsy.com ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
