import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { jobFamilyService } from "@/lib/services/jobFamilyService";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    const jobFamilies = await jobFamilyService.getJobFamilies({ activeOnly });
    return NextResponse.json(jobFamilies);
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching job families", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const jobFamily = await jobFamilyService.createJobFamily(json, session.user.id);
    return NextResponse.json(jobFamily);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "DUPLICATE_JOB_FAMILY") {
        return NextResponse.json(
          { error: "Duplicate record found", code: "DUPLICATE_JOB_FAMILY", message: "A job family with this name already exists" },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { error: "Error creating job family", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
