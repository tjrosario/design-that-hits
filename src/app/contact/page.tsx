import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

export const metadata: Metadata = {
  title:       "Contact Us",
  description: "Get in touch with Design That Hits. Ask about custom orders, wholesale enquiries, or just say hello.",
  alternates:  { canonical: `${SITE_URL}/contact` },
  openGraph: {
    type:        "website",
    locale:      "en_US",
    siteName:    "Design That Hits",
    title:       "Contact Design That Hits",
    description: "Get in touch with Design That Hits. Ask about custom orders, wholesale enquiries, or just say hello.",
    url:         `${SITE_URL}/contact`,
    images: [{ url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630, alt: "Contact Design That Hits" }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Contact Design That Hits",
    description: "Get in touch — custom orders, questions, or just say hello.",
  },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  const contactJsonLd = {
    "@context":  "https://schema.org",
    "@type":     "ContactPage",
    "@id":       `${SITE_URL}/contact#webpage`,
    url:          `${SITE_URL}/contact`,
    name:         "Contact Design That Hits",
    description:  "Get in touch with Design That Hits for custom orders, questions, or general enquiries.",
    inLanguage:   "en-US",
    isPartOf:     { "@id": `${SITE_URL}/#website` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home",    item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE_URL}/contact` },
      ],
    },
  };

  return (
    <div className="mx-auto max-w-screen-xl px-5 py-12">
      <JsonLd data={contactJsonLd} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "var(--brand)", fontFamily: "var(--font-display)" }}>
            Get in Touch
          </p>
          <h1
            className="text-5xl md:text-6xl font-black uppercase leading-none mb-6"
            style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
          >
            We&apos;d Love<br />to Hear<br />
            <span style={{ color: "var(--brand)" }}>From You.</span>
          </h1>
          <p className="text-base leading-relaxed mb-10" style={{ color: "var(--text-muted)" }}>
            Have a question, custom request, or just want to say hi? Reach out and we&apos;ll get back to you as soon as possible.
          </p>

          <div className="space-y-3">
            <a
              href="mailto:hello@designthathits.com"
              className="panel flex items-center gap-4 p-4 transition-colors hover:opacity-90"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--gradient-brand)", color: "var(--brand-ink)" }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-soft)", fontFamily: "var(--font-display)" }}>Email</p>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>hello@designthathits.com</p>
              </div>
            </a>

            <a
              href="https://designthathits.etsy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="panel flex items-center gap-4 p-4 transition-colors hover:opacity-90"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--gradient-brand)", color: "var(--brand-ink)" }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-soft)", fontFamily: "var(--font-display)" }}>Etsy</p>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Message us on Etsy ↗</p>
              </div>
            </a>
          </div>
        </div>

        <div className="rounded-3xl p-8" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "0 4px 24px -12px hsl(var(--shadow-color) / var(--shadow-strength))" }}>
          <h2 className="text-2xl font-black uppercase mb-6" style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}>
            Send a Message
          </h2>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
