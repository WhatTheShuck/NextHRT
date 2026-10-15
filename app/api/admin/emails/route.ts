import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import {
  emailLogService,
  type EmailLogFilter,
} from "@/lib/services/emailLogService";

const FILTERS: EmailLogFilter[] = ["sent", "queued", "failed", "cancelled"];

// GET the outgoing email log (Admin only).
// Query: ?status=sent|queued|failed|cancelled&q=<search>&page=&pageSize=
export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const filter = FILTERS.includes(status as EmailLogFilter)
    ? (status as EmailLogFilter)
    : undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10) || 25),
  );

  try {
    const result = await emailLogService.list({
      filter,
      search: searchParams.get("q") ?? undefined,
      page,
      pageSize,
    });
    return NextResponse.json({ ...result, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch email log",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
