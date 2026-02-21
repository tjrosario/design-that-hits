"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({ name: "", email: "", message: "" });

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (status === "success") {
    return (
      <div className="text-center py-10" role="status">
        <p className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Message Sent!</p>
        <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>We&apos;ll get back to you soon.</p>
        <button onClick={() => setStatus("idle")} className="filter-pill">Send another</button>
      </div>
    );
  }

  const inputStyle = {
    backgroundColor: 'var(--cream)',
    color: 'var(--ink)',
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    width: '100%',
    outline: 'none',
    boxShadow: 'inset 0 0 0 1.5px var(--sand)',
    transition: 'box-shadow 0.15s ease',
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-display)' }}>Name *</label>
        <input id="contact-name" type="text" required value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          style={inputStyle} placeholder="Your name" aria-required="true"
          onFocus={e => (e.target as HTMLInputElement).style.boxShadow = `inset 0 0 0 2px var(--ink)`}
          onBlur={e => (e.target as HTMLInputElement).style.boxShadow = `inset 0 0 0 1.5px var(--sand)`}
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-display)' }}>Email *</label>
        <input id="contact-email" type="email" required value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          style={inputStyle} placeholder="your@email.com" aria-required="true"
          onFocus={e => (e.target as HTMLInputElement).style.boxShadow = `inset 0 0 0 2px var(--ink)`}
          onBlur={e => (e.target as HTMLInputElement).style.boxShadow = `inset 0 0 0 1.5px var(--sand)`}
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-display)' }}>Message *</label>
        <textarea id="contact-message" required rows={5} value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          style={{ ...inputStyle, resize: 'none' }} placeholder="Tell us what's on your mind..." aria-required="true"
          onFocus={e => (e.target as HTMLTextAreaElement).style.boxShadow = `inset 0 0 0 2px var(--ink)`}
          onBlur={e => (e.target as HTMLTextAreaElement).style.boxShadow = `inset 0 0 0 1.5px var(--sand)`}
        />
      </div>
      {status === "error" && (
        <p role="alert" className="text-sm font-medium" style={{ color: 'var(--orange)' }}>
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
