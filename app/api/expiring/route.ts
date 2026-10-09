import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentStatusService } from "@/lib/services/documentStatusService";
import { actorOf, errorResponse } from "@/lib/documentSubmissionHttp";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  try {
    const status = await documentStatusService.getStatus(actorOf(session), {
      departmentId: Number(sp.get("departmentId")) || undefined,
      employeeId: Number(sp.get("employeeId")) || undefined,
    });
    return NextResponse.json(status);
  } catch (e) {
    return errorResponse(e);
  }
}
