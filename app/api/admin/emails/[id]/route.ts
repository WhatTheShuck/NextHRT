import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { emailLogService } from "@/lib/services/emailLogService";

// GET one email from the log, including its body and attachment status (Admin only).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;
  const emailId = parseInt(id, 10);
  if (Number.isNaN(emailId)) {
    return NextResponse.json({ message: "Invalid email id" }, { status: 400 });
  }

  const email = await emailLogService.get(emailId);
  if (!email) {
    return NextResponse.json({ message: "Email not found" }, { status: 404 });
  }
  return NextResponse.json(email);
}
