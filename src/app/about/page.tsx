import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About – Design That Hits",
  description: "Learn about Design That Hits, a print-on-demand Etsy shop specializing in unique gifts, wrapping paper, and party designs.",
};

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-screen-xl px-5 pt-6 pb-14">
        <div
          className="rounded-3xl px-10 py-16 md:py-20 text-center relative overflow-hidden"
          style={{ backgroundColor: '#C8BEA8' }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(ellipse at 20% 50%, #E8C547 0%, transparent 40%), radial-gradient(ellipse at 80% 50%, #7DC4A8 0%, transparent 40%)',
          }} />
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--orange)', fontFamily: 'var(--font-display)' }}>
              Our Story
            </p>
            <h1
              className="text-5xl md:text-7xl font-black uppercase leading-none mb-6"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
            >
              Crafted to make<br />every moment<br />
              <span style={{ color: 'var(--orange)' }}>Memorable.</span>
            </h1>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--ink-soft)' }}>
              We believe the little things — the wrapping paper, the party decoration — are what people remember most.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-screen-xl px-5 pb-16">
        {/* Values */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
          {[
            { color: '#E8C547', label: 'Wrapping Paper', desc: 'Stand-out patterns for every occasion' },
            { color: '#7DC4A8', label: 'Party Designs',  desc: 'Banners, invites, decorations & more' },
            { color: '#E88C6A', label: 'Unique Gifts',   desc: 'Thoughtful designs for people you love' },
            { color: '#A8C4E8', label: 'Print on Demand',desc: 'Ordered and printed fresh, just for you' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl p-5 min-h-[130px] flex flex-col justify-between" style={{ backgroundColor: item.color }}>
              <p className="font-black uppercase text-lg leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{item.label}</p>
              <p className="text-xs leading-snug mt-2" style={{ color: 'var(--ink-soft)' }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="max-w-2xl">
          <h2
            className="text-4xl font-black uppercase mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
          >
            Where It All Began
          </h2>
          <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--ink-muted)' }}>
            Design That Hits was born from a love of bold, meaningful design. We started with a simple belief: the wrapping is part of the gift, and every party deserves something that looks as good as it feels.
          </p>
          <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--ink-muted)' }}>
            Our designs are print-on-demand — ordered when you need them, printed fresh and shipped directly. Every piece is made to be noticed, remembered, and treasured.
          </p>
          <a
            href="https://designthathits.etsy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cta inline-flex"
          >
            Shop on Etsy
            <span className="arrow-circle">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
