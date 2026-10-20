import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/contact/route";

const SITE = "https://designthathits.com";

function send(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request(`${SITE}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

const valid = { name: "Tommy", email: "t@example.com", message: "Hello there" };

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("validation", () => {
  it.each([
    ["empty body", {}],
    ["missing message", { name: "a", email: "a@b.co" }],
    ["bad email", { ...valid, email: "nope" }],
    ["bracket-only email", { ...valid, email: "<>" }],
    ["comma in domain", { ...valid, email: "a@b,c.co" }],
    ["over-long message", { ...valid, message: "x".repeat(4100) }],
  ])("rejects %s with a specific message", async (_label, body) => {
    const res = await send(body);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
    expect(data.error.length).toBeGreaterThan(0);
  });

  // JSON.parse("null") succeeds, so this was an unhandled 500 rather than a 400.
  it("rejects a null body rather than throwing", async () => {
    const res = await send("null");
    expect(res.status).toBe(400);
  });

  it("rejects an array body", async () => {
    const res = await send([1, 2, 3]);
    expect(res.status).toBe(400);
  });

  // Mail clients copy addresses as <bob@example.com>; the brackets are stripped rather
  // than passed on to become an opaque 502.
  it("accepts a bracketed address", async () => {
    const res = await send({ ...valid, email: "<bob@example.com>" });
    expect(res.status).toBe(503); // past validation, stopped by the missing key
  });
});

describe("origin", () => {
  // Without this any page could POST from a visitor's browser: text/plain makes it a
  // CORS-simple request, so there is no preflight and the opaque response does not
  // matter once the mail has gone.
  it("refuses a cross-site origin", async () => {
    const res = await send(valid, { Origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("allows its own origin", async () => {
    const res = await send(valid, { Origin: SITE });
    expect(res.status).toBe(503);
  });

  it("allows a request with no origin header", async () => {
    expect((await send(valid)).status).toBe(503);
  });
});

describe("bot trap", () => {
  it("accepts the submission without sending, and says nothing useful to the bot", async () => {
    const res = await send({ ...valid, referralSource: "spam" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("unconfigured", () => {
  // The rule this route exists under: never report success for work that did not happen.
  it("returns 503 and points elsewhere when there is no API key", async () => {
    const res = await send(valid);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not connected|Etsy/i);
  });

  // It used to charge the limiter before checking the key, so a visitor meeting the
  // honest 503 three times was then told they had sent too many messages.
  it("never rate limits when nothing has been sent", async () => {
    for (let i = 0; i < 6; i++) {
      const res = await send({ ...valid, email: "repeat@example.com" });
      expect(res.status, `attempt ${i + 1}`).toBe(503);
    }
  });
});
