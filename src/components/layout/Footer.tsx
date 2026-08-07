import Link from "next/link";

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
              {[{ href: '/', l: 'Shop' }, { href: '/about', l: 'About us' }, { href: '/contact', l: 'Contact' }].map(({ href, l }) => (
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
