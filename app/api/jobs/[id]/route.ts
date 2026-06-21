import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

type JobAction = "retry" | "cancel";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;
  const jobId = parseInt(id, 10);
  if (Number.isNaN(jobId)) {
    return NextResponse.json({ message: "Invalid job id" }, { status: 400 });
  }

  const { action } = (await request.json()) as { action: JobAction };

  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }

  if (action === "retry") {
    // Only a job that has stopped running can be retried.
    if (job.status !== "Failed" && job.status !== "Cancelled") {
      return NextResponse.json(
        { message: `Cannot retry a job with status ${job.status}` },
        { status: 409 },
      );
    }
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "Pending",
        attempts: 0, // manual retry grants a fresh attempt budget
        errorMessage: null,
        resultSummary: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
      },
    });
    return NextResponse.json({ success: true, status: "Pending" });
  }

  if (action === "cancel") {
    // Only a job that hasn't started can be safely cancelled; a Running job
    // is mid-flight and Completed/Failed are terminal.
    if (job.status !== "Pending") {
      return NextResponse.json(
        { message: `Cannot cancel a job with status ${job.status}` },
        { status: 409 },
      );
    }
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: "Cancelled", completedAt: new Date() },
    });
    return NextResponse.json({ success: true, status: "Cancelled" });
  }

  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}
