import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Contact endpoint.
 *
 * The rule this route exists under: never report success for work that did not happen.
 * It once accepted a submission, logged it, and returned `{success:true}` while sending
 * nothing, and real enquiries were lost with no signal to anyone.
 *
 * So every path that drops a message says so, and the one path that drops a message
 * deliberately, the bot trap, writes a log line. With no `RESEND_API_KEY` the route
 * returns 503 and the form points the visitor at the mailto and the Etsy link.
 *
 * Resend's REST API is one POST, so there is no SDK: a dependency for a single fetch is
 * a dependency to keep current for no gain.
 */

const ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8000;

/*
  Trimmed and checked for emptiness, not just `??`. A variable created blank in the
  Vercel dashboard is a common slip, and `??` only catches undefined, so a blank
  CONTACT_EMAIL would send `to: [""]` and fail every message with only a log line.
*/
const env = (name: string, fallback: string) => process.env[name]?.trim() || fallback;

/*
  `from` has to be on a domain Resend has verified, so it cannot be the visitor's
  address. Theirs goes in `reply_to`, which is what makes replying work.
*/
const FROM = () => env("CONTACT_FROM", "Design That Hits <hello@designthathits.com>");
const TO = () => env("CONTACT_EMAIL", "hello@designthathits.com");

const MAX = { name: 100, email: 254, message: 4000 } as const;
const EMAIL = /^[^\s@<>,]+@[^\s@<>,]+\.[a-z0-9-]{2,}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/g;

/*
  A speed bump, keyed on IP and address together, plus a ceiling on total sends.

  Per instance, so a serverless fleet gives each cold start a fresh map. Keying on the
  address alone would be worse than useless: the sender picks it, so one character
  defeats the limit. The global ceiling is the part that actually protects the Resend
  allowance, because a cross-site POST arrives from thousands of real visitor IPs and no
  per-key limit touches that.
*/
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_KEY = 3;
const MAX_TOTAL_PER_WINDOW = 30;
const MAX_KEYS = 500;

const seen = new Map<string, number[]>();
let sends: number[] = [];

function fresh(times: number[], now: number) {
  return times.filter((t) => now - t < WINDOW_MS);
}

/** Read-only: the window is charged on a successful send, not on an attempt. */
function overLimit(key: string, now = Date.now()): boolean {
  sends = fresh(sends, now);
  if (sends.length >= MAX_TOTAL_PER_WINDOW) return true;
  return fresh(seen.get(key) ?? [], now).length >= MAX_PER_KEY;
}

function recordSend(key: string, now = Date.now()) {
  sends.push(now);
  seen.set(key, [...fresh(seen.get(key) ?? [], now), now]);
  // Bounded by eviction, not by expiry: inside one window nothing is expired, so relying
  // on expiry let the map reach 20,000 entries and made every request scan all of them.
  while (seen.size > MAX_KEYS) seen.delete(seen.keys().next().value as string);
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function clean(value: unknown, limit: number): string {
  return String(value ?? "").replace(CONTROL, "").trim().slice(0, limit + 1);
}

export async function POST(request: Request) {
  /*
    Same-origin only. Without this, any page can POST here from a visitor's browser:
    `text/plain` makes it a CORS-simple request, so there is no preflight and the opaque
    response does not matter once the mail has gone. It also arrives from thousands of
    real IPs, which no per-key limit can see.
  */
  const origin = request.headers.get("origin");
  if (origin) {
    const expected = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";
    if (new URL(origin).origin !== new URL(expected).origin) {
      return bad("That request did not come from this site.", 403);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("That request could not be read. Please try again.");
  }
  // `JSON.parse("null")` succeeds, so a type guard is needed rather than a try/catch.
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return bad("That request could not be read. Please try again.");
  }
  const input = body as Record<string, unknown>;

  const name = clean(input.name, MAX.name);
  const message = clean(input.message, MAX.message);
  // Mail clients copy an address as <bob@example.com>, which the regex would otherwise
  // accept and Resend would then reject as an opaque failure.
  const email = clean(input.email, MAX.email).replace(/^<|>$/g, "");
  const trap = clean(input.referralSource, 100);

  if (trap) {
    // Logged, never silent. A false positive here is a real message thrown away, and the
    // only way to find out it is happening is a line in the Vercel log.
    console.warn(`[contact] bot trap fired, message discarded. from=${email || "(none)"} name=${name || "(none)"}`);
    return NextResponse.json({ ok: true });
  }

  if (!name || !email || !message) return bad("Name, email and message are all required.");
  if (name.length > MAX.name) return bad("That name is too long.");
  if (email.length > MAX.email || !EMAIL.test(email)) return bad("That email address does not look right.");
  if (message.length > MAX.message) return bad(`Please keep the message under ${MAX.message} characters.`);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  // Checked before the limiter, so a visitor meeting the unconfigured 503 three times is
  // not then told they have sent too many messages when none has been sent at all.
  if (!apiKey) {
    return bad("The contact form is not connected yet. Email us directly or message us on Etsy.", 503);
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const key = `${ip}|${email.toLowerCase()}`;
  if (overLimit(key)) return bad("That is a few messages in a short time. Try again shortly.", 429);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      // Without this a hung connection runs until the platform kills the function, and
      // the visitor gets the platform's own non-JSON error body.
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      body: JSON.stringify({
        from: FROM(),
        to: [TO()],
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

  recordSend(key);
  return NextResponse.json({ ok: true });
}
