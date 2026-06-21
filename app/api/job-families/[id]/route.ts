import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { jobFamilyService } from "@/lib/services/jobFamilyService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const jobFamily = await jobFamilyService.getJobFamilyById(parseInt(id));
    return NextResponse.json(jobFamily);
  } catch (error) {
    if (error instanceof Error && error.message === "JOB_FAMILY_NOT_FOUND") {
      return NextResponse.json({ error: "Job family not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Error fetching job family", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function PUT(
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
  try {
    const json = await request.json();
    const updated = await jobFamilyService.updateJobFamily(parseInt(id), json, session.user.id);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "JOB_FAMILY_NOT_FOUND":
          return NextResponse.json({ error: "Job family not found" }, { status: 404 });
        case "DUPLICATE_JOB_FAMILY":
          return NextResponse.json(
            { error: "Duplicate record found", code: "DUPLICATE_JOB_FAMILY", message: "A job family with this name already exists" },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      { error: "Error updating job family", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
  try {
    const result = await jobFamilyService.deleteJobFamily(parseInt(id), session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "JOB_FAMILY_NOT_FOUND":
          return NextResponse.json({ error: "Job family not found" }, { status: 404 });
        case "JOB_FAMILY_HAS_EMPLOYEES":
          return NextResponse.json(
            { error: "Cannot delete job family with assigned employees" },
            { status: 400 },
          );
      }
    }
    return NextResponse.json(
      { error: "Error deleting job family", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
