import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

const CONTACT_EMAIL = "hello@designthathits.com";
const ETSY_SHOP_URL = "https://designthathits.etsy.com";

/*
  Replaces the contact form until email sending is wired up.

  The form could not be left in place: its API route was a stub that logged the message
  and returned success, so visitors were told their message had been sent while it went
  nowhere. An FAQ answers the questions that form was mostly receiving, and every route
  out of it is a real one — a mailto and Etsy Messages, both of which work today.

  Kept deliberately free of invented specifics (delivery windows, exact policies) since
  those belong to the Etsy listings and would be wrong the moment they change.
*/
const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I place an order?",
    a: "Every design is sold through our Etsy shop, so checkout, payment and delivery are all handled by Etsy. Browse the full catalogue here on the site and follow any product through to its Etsy listing to order.",
  },
  {
    q: "Can you make a custom design?",
    a: "Yes. Custom colours, names, dates and one-off designs are all possible. Message us on Etsy or send an email with what you have in mind and we will come back to you with options.",
  },
  {
    q: "How long will my order take?",
    a: "Everything is printed on demand rather than held in stock, so each item is made after you order it. Current production and delivery estimates are shown on each Etsy listing at checkout.",
  },
  {
    q: "Do you take bulk or wholesale orders?",
    a: "We do. Email us with the design, quantity and the date you need it by, and we will confirm pricing and timings.",
  },
  {
    q: "Something is wrong with my order. What now?",
    a: "Get in touch and we will put it right. Orders placed through Etsy are also covered by Etsy's purchase protection, and messaging us there keeps the whole order history in one place.",
  },
];

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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${SITE_URL}/contact#faq`,
          isPartOf: { "@id": `${SITE_URL}/contact#webpage` },
          // Generated from FAQS so the structured data and the visible answers are always
          // the same text, which is what Google requires for FAQ rich results.
          mainEntity: FAQS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />

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

        <div
          className="rounded-3xl p-6 sm:p-8"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border-soft)",
            boxShadow: "0 4px 24px -12px hsl(var(--shadow-color) / var(--shadow-strength))",
          }}
        >
          <h2
            className="text-2xl mb-2"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text)" }}
          >
            Common Questions
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Answers to what we get asked most. Still stuck? Email us and we will help.
          </p>

          {/* <details> gives a keyboard-accessible disclosure with no JavaScript and no
              state to manage, and each answer stays in the DOM so it is indexable. */}
          <div className="space-y-2">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl px-4 py-3"
                style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-soft)" }}
              >
                <summary
                  className="cursor-pointer list-none flex items-start justify-between gap-3 text-sm font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  <span>{item.q}</span>
                  <span
                    className="mt-0.5 flex-shrink-0 transition-transform group-open:rotate-45"
                    style={{ color: "var(--brand)" }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-soft)" }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          <div
            className="mt-7 pt-6 flex flex-col sm:flex-row gap-3"
            style={{ borderTop: "1px solid var(--border-soft)" }}
          >
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn-cta flex-1">
              Email us
            </a>
            <a
              href={ETSY_SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline flex-1"
            >
              Message on Etsy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
