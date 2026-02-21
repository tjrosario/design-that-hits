import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: "All fields required." }, { status: 400 });
    }

    // PLACEHOLDER: Integrate with your email service here.
    // Options: Resend, SendGrid, Nodemailer, Formspree, etc.
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'contact@designthathits.com',
    //   to: process.env.CONTACT_EMAIL!,
    //   subject: `Contact form: ${name}`,
    //   text: `From: ${email}\n\n${message}`,
    // });

    console.log("[Contact form submission]", { name, email, message });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }
}
