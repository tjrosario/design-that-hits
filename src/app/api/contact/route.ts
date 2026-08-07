import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Contact endpoint — intentionally disabled.
 *
 * This route used to accept a submission, console.log it, and return { success: true }.
 * Nothing sent an email, so the UI told visitors their message had been delivered while
 * it was silently dropped. Reporting success for work that did not happen is worse than
 * having no endpoint at all: real enquiries were lost with no signal to anyone.
 *
 * It now refuses every request with 503 and points at the channels that actually work.
 * The contact page no longer renders a form, so nothing in the app calls this; the 503
 * exists for anything holding a stale reference, such as a cached page or a bookmarked
 * POST.
 *
 * To re-enable: wire an email provider (Resend, SendGrid, Nodemailer) here, restore
 * <ContactForm /> on src/app/contact/page.tsx — the component is still in the repo,
 * unchanged — and delete this note.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "The contact form is temporarily unavailable. Please email hello@designthathits.com or message us on Etsy.",
    },
    { status: 503 }
  );
}
