"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // `referralSource` is the bot trap. Not "company", "organization" or "phone": those
  // are names browser and password-manager autofill recognise, so a real person would
  // have it filled for them and their message would be discarded.
  const [form, setForm] = useState({ name: "", email: "", message: "", referralSource: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      // The platform can answer with a non-JSON body on a timeout or a crash, and an
      // unguarded parse would put "Unexpected token" in front of the visitor.
      const data = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) throw new Error(data.error ?? "That message did not send. Please try again.");
      setStatus("success");
      setForm({ name: "", email: "", message: "", referralSource: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (status === "success") {
    return (
      <div className="text-center py-10" role="status">
        <p className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Message Sent!</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>We&apos;ll get back to you soon.</p>
        <button onClick={() => setStatus("idle")} className="filter-pill">Send another</button>
      </div>
    );
  }

  const inputStyle = {
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    width: '100%',
    outline: 'none',
    boxShadow: 'inset 0 0 0 1.5px var(--border)',
    transition: 'box-shadow 0.15s ease',
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* sr-only rather than an absolutely positioned first child, which contributed no
          height but still gave the Name field a space-y margin above it. */}
      {/* Off-screen rather than display:none, which some bots skip. aria-hidden and
          tabIndex keep it from screen readers and the keyboard; autoComplete="new-password"
          is the value Chromium actually honours for suppressing address autofill. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="contact-referral">Do not fill this in</label>
        <input
          id="contact-referral"
          name="referralSource"
          type="text"
          tabIndex={-1}
          autoComplete="new-password"
          value={form.referralSource}
          onChange={(e) => setForm((f) => ({ ...f, referralSource: e.target.value }))}
        />
      </div>
      <div>
        <label htmlFor="contact-name" className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>Name *</label>
        <input id="contact-name" type="text" required value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          style={inputStyle} placeholder="Your name" aria-required="true"
          onFocus={e => (e.target as HTMLInputElement).style.boxShadow = `inset 0 0 0 2px var(--text)`}
          onBlur={e => (e.target as HTMLInputElement).style.boxShadow = `inset 0 0 0 1.5px var(--border)`}
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>Email *</label>
        <input id="contact-email" type="email" required value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          style={inputStyle} placeholder="your@email.com" aria-required="true"
          onFocus={e => (e.target as HTMLInputElement).style.boxShadow = `inset 0 0 0 2px var(--text)`}
          onBlur={e => (e.target as HTMLInputElement).style.boxShadow = `inset 0 0 0 1.5px var(--border)`}
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>Message *</label>
        <textarea id="contact-message" required rows={5} value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          style={{ ...inputStyle, resize: 'none' }} placeholder="Tell us what's on your mind..." aria-required="true"
          onFocus={e => (e.target as HTMLTextAreaElement).style.boxShadow = `inset 0 0 0 2px var(--text)`}
          onBlur={e => (e.target as HTMLTextAreaElement).style.boxShadow = `inset 0 0 0 1.5px var(--border)`}
        />
      </div>
      {status === "error" && (
        <p role="alert" className="text-sm font-medium" style={{ color: 'var(--brand)' }}>
          {errorMsg || "Something went wrong. Please try again."}
        </p>
      )}
      <button type="submit" disabled={status === "loading"} className="btn-cta w-full justify-center disabled:opacity-50">
        {status === "loading" ? "Sending..." : "Send Message"}
        <span className="arrow-circle">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </span>
      </button>
    </form>
  );
}
