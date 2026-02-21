"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contacts" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 px-5 py-4"
      style={{ backgroundColor: 'var(--cream)' }}
    >
      <div className="mx-auto max-w-screen-xl flex items-center justify-between">

        {/* Logo */}
        <Link
          href="/"
          className="text-base font-black tracking-[0.18em] uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '0.2em' }}
        >
          Design That Hits
        </Link>

        {/* Desktop pill nav */}
        <nav aria-label="Main navigation" className="hidden md:flex">
          <div className="nav-pill">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-pill-link"
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Right icons */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="https://designthathits.etsy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--ink)' }}
            aria-label="Shop on Etsy"
          >
            {/* Etsy bag icon */}
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--ink-muted)' }}>Etsy Shop</span>
          </a>
          <button aria-label="Wishlist" style={{ color: 'var(--ink)' }}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded-full p-2"
          style={{ color: 'var(--ink)' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav aria-label="Mobile navigation" className="md:hidden mt-3 rounded-2xl p-4" style={{ background: 'var(--ink)' }}>
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color: pathname === link.href ? 'var(--ink)' : 'rgba(255,255,255,0.7)',
                    background: pathname === link.href ? 'white' : 'transparent',
                  }}
                  aria-current={pathname === link.href ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <a
                href="https://designthathits.etsy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{ color: 'var(--orange)' }}
              >
                Shop on Etsy ↗
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
