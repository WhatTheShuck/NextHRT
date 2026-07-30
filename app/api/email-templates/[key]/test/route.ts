import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import { mailService } from "@/lib/services/mailService";

// POST send the draft copy to the signed-in admin, so they can see the real
// thing in their own mail client before it goes out to managers or HR.
//
// Deliberately hard-wired to the session user's address rather than an
// arbitrary recipient: this is a preview tool, not a way to mail anyone.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const recipient = guard.session.user.email;
  if (!recipient) {
    return NextResponse.json(
      { error: "Your account has no email address to send a test to." },
      { status: 400 },
    );
  }

  const { key } = await params;

  try {
    const json = await request.json();
    if (typeof json.subject !== "string" || typeof json.body !== "string") {
      return NextResponse.json(
        { error: "subject and body are required" },
        { status: 400 },
      );
    }

    const preview = await emailTemplateService.renderPreview(
      decodeURIComponent(key),
      { subject: json.subject, body: json.body },
    );

    // sendNow, not send: the admin clicked a button and is waiting to hear
    // whether SMTP accepted it. A queued job would report success before the
    // message had actually gone anywhere.
    await mailService.sendNow({
      to: recipient,
      subject: `[TEST] ${preview.subject || decodeURIComponent(key)}`,
      html: preview.body,
    });

    return NextResponse.json({ sentTo: recipient });
  } catch (error) {
    if (error instanceof Error && error.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "Could not send the test email",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
