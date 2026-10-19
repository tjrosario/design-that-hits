import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Contact endpoint.
 *
 * This route previously accepted a submission, logged it, and returned success while
 * sending nothing, so real enquiries were lost with no signal to anyone. It was then
 * disabled outright. It now actually sends, and the rule that came out of that history
 * still governs it: never report success for work that did not happen.
 *
 * With no `RESEND_API_KEY` it returns 503 and says so, which the form shows to the
 * visitor alongside the mailto and the Etsy link. That is the honest failure.
 *
 * Resend's REST API is one POST, so there is no SDK here. A dependency for a single
 * fetch would be a dependency to keep current for no gain.
 */

const ENDPOINT = "https://api.resend.com/emails";

/*
  `from` must be on a domain verified with Resend, so it cannot be the visitor's address.
  Their address goes in `reply_to`, which is what makes replying work.
*/
const FROM = process.env.CONTACT_FROM ?? "Design That Hits <hello@designthathits.com>";
const TO = process.env.CONTACT_EMAIL ?? "hello@designthathits.com";

const MAX = { name: 100, email: 254, message: 4000 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/*
  One submission per address per window, held in memory.

  Honest about what this is: per instance, so a serverless fleet gives each cold start a
  fresh map and a determined sender gets more than three. It is a speed bump for casual
  abuse, not a real limiter. A shared store is the fix if this ever gets hit properly.
*/
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const recent = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) return true;
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 500) {
    for (const [k, v] of recent) if (v.every((t) => now - t >= WINDOW_MS)) recent.delete(k);
  }
  return false;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("That request could not be read. Please try again.");
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  // A field positioned off-screen and left empty by a person. Anything in it is a bot,
  // and the 200 is deliberate: an error would tell the bot what tripped it.
  const honeypot = String(body.company ?? "").trim();

  if (honeypot) return NextResponse.json({ ok: true });

  if (!name || !email || !message) return bad("Name, email and message are all required.");
  if (name.length > MAX.name) return bad("That name is too long.");
  if (email.length > MAX.email || !EMAIL.test(email)) return bad("That email address does not look right.");
  if (message.length > MAX.message) return bad(`Please keep the message under ${MAX.message} characters.`);

  const key = email.toLowerCase();
  if (rateLimited(key)) return bad("That is a few messages in a short time. Try again shortly.", 429);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return bad("The contact form is not connected yet. Email us directly or message us on Etsy.", 503);
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Site message from ${name}`,
        text: `${message}\n\n---\nFrom: ${name} <${email}>\nSent from the contact form on designthathits.com`,
      }),
    });
  } catch {
    return bad("Could not reach the mail service. Please try again or email us directly.", 502);
  }

  if (!response.ok) {
    // The body can carry an API key or an address, so it goes to the log, not the visitor.
    console.error(`[contact] Resend returned ${response.status}: ${await response.text()}`);
    return bad("That message did not send. Please try again or email us directly.", 502);
  }

  return NextResponse.json({ ok: true });
}
