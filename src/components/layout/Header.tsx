"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import Image from "next/image";

// A nav item is current across its own subtree, so Shop stays highlighted on
// /collections/cats. Exact match for "/", which would otherwise match everything.
function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const navLinks = [
  { href: "/", label: "Home" },
  // The entry point to every collection and intersection page. Previously those were
  // reachable only from the footer and a link below the home grid.
  { href: "/collections", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // The home page has its own search in the page body, and it owns the committed query.
  // Rendering a second input here would be two boxes whose values never agree.
  const showSearch = pathname !== "/";

  return (
    <header
      className="sticky top-0 z-40 px-3 py-3 sm:px-5 sm:py-4 backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg) 88%, transparent)",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <div className="mx-auto max-w-screen-xl flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        {/* Wordmark — serif, with the middle word in brand pink. min-w-0 + truncate let
            it give way rather than push the controls off-screen on narrow phones. */}
        {/* aria-label on the link, alt="" on both images: only one wordmark is visible
            at a time, and this gives the link one accessible name whichever that is. */}
        <Link href="/" aria-label="Design That Hits" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <Image
            src="/logo-mark.png"
            alt=""
            width={384}
            height={354}
            priority
            className="h-8 sm:h-9 w-auto flex-shrink-0"
          />
          <span aria-hidden="true" className="logo-wordmark h-8 sm:h-9 flex-shrink-0" />
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden md:flex">
          <div className="nav-pill">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-pill-link"
                aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {showSearch && (
          <HeaderSearch
            inputId="header-search"
            className="hidden md:block flex-1 min-w-0 max-w-[13rem] lg:max-w-[18rem]"
          />
        )}

        {/* Right cluster — never shrinks, so the controls stay tappable */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="https://designthathits.etsy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cta hidden sm:inline-flex !py-2.5 !px-5 !text-[0.8125rem]"
            aria-label="Shop on Etsy"
          >
            Shop on Etsy
          </a>

          <ThemeToggle />

          {/* Mobile menu */}
          <button
            type="button"
            className="icon-btn md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation menu"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="md:hidden mt-3 panel p-3 mx-auto max-w-screen-xl"
        >
          {showSearch && (
            <HeaderSearch
              inputId="mobile-search"
              className="mb-3"
              autoFocus
              onNavigate={() => setMobileOpen(false)}
            />
          )}

          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color: isCurrent(pathname, link.href) ? "var(--brand-ink)" : "var(--text-soft)",
                    background: isCurrent(pathname, link.href) ? "var(--gradient-brand)" : "transparent",
                  }}
                  aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
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
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ color: "var(--brand)" }}
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
