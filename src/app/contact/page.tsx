import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact – Design That Hits",
  description: "Get in touch with Design That Hits.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-screen-xl px-5 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--orange)', fontFamily: 'var(--font-display)' }}>
            Get in Touch
          </p>
          <h1
            className="text-5xl md:text-6xl font-black uppercase leading-none mb-6"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
          >
            We&apos;d Love<br />to Hear<br />
            <span style={{ color: 'var(--orange)' }}>From You.</span>
          </h1>
          <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--ink-muted)' }}>
            Have a question, custom request, or just want to say hi? Reach out and we&apos;ll get back to you as soon as possible.
          </p>

          <div className="space-y-3">
            <a
              href="mailto:hello@designthathits.com"
              className="flex items-center gap-4 rounded-2xl p-4 transition-colors hover:opacity-80"
              style={{ backgroundColor: '#E8C547' }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--ink)' }}>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="white" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-display)' }}>Email</p>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>hello@designthathits.com</p>
              </div>
            </a>

            <a
              href="https://designthathits.etsy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-2xl p-4 transition-colors hover:opacity-80"
              style={{ backgroundColor: '#7DC4A8' }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--ink)' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="white" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-display)' }}>Etsy</p>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Message us on Etsy ↗</p>
              </div>
            </a>
          </div>
        </div>

        <div className="rounded-3xl p-8" style={{ backgroundColor: 'var(--white)', boxShadow: '0 4px 24px rgba(26,24,20,0.08)' }}>
          <h2
            className="text-2xl font-black uppercase mb-6"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
          >
            Send a Message
          </h2>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
