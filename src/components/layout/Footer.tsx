import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t" style={{ borderColor: 'var(--sand)', backgroundColor: 'var(--cream-dark)' }}>
      <div className="mx-auto max-w-screen-xl px-5 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <p
              className="font-black uppercase tracking-widest text-lg mb-3"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '0.15em' }}
            >
              Design That Hits
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Print-on-demand gifts, wrapping paper & party designs for every occasion.
            </p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-display)' }}>
              Navigate
            </p>
            <ul className="space-y-2">
              {[{ href: '/', l: 'Shop' }, { href: '/about', l: 'About us' }, { href: '/contact', l: 'Contact' }].map(({ href, l }) => (
                <li key={href}>
                  <Link href={href} className="text-sm font-medium transition-colors hover:underline" style={{ color: 'var(--ink-soft)' }}>
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-display)' }}>
              Stay Connected
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--ink-muted)' }}>Updates & new arrivals in your inbox</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 rounded-full px-4 py-2 text-xs focus:outline-none font-medium"
                style={{ backgroundColor: 'var(--white)', color: 'var(--ink)', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                aria-label="Email for newsletter"
              />
              <button
                className="rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0 text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--orange)' }}
                aria-label="Subscribe"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'var(--sand)' }}>
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            © {new Date().getFullYear()} Design That Hits. All rights reserved.
          </p>
          <a
            href="https://designthathits.etsy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold"
            style={{ color: 'var(--orange)' }}
          >
            designthathits.etsy.com ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
