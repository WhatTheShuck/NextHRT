import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { JobType, JobStatus } from "@/generated/prisma_client/client";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as JobStatus | null;
  const type = searchParams.get("type") as JobType | null;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const [jobs, total] = await Promise.all([
    prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.backgroundJob.count({ where }),
  ]);

  return NextResponse.json({ jobs, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, payload } = body as {
      type: JobType;
      payload?: Record<string, unknown>;
    };

    if (!type) {
      return NextResponse.json({ message: "Missing required field: type" }, { status: 400 });
    }

    await enqueue(type, payload);

    return NextResponse.json({ success: true, message: `Job ${type} enqueued` });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to enqueue job",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
