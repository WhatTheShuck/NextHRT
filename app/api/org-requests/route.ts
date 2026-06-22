import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { orgRequestService } from "@/lib/services/orgRequestService";

export async function POST(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const { type, requestedData } = await request.json();

    if (type !== "Department" && type !== "Location") {
      return NextResponse.json({ message: "Invalid type" }, { status: 400 });
    }

    let orgRequest;
    if (type === "Department") {
      if (!requestedData?.name) {
        return NextResponse.json({ message: "name is required" }, { status: 400 });
      }
      orgRequest = await orgRequestService.createDepartmentRequest(requestedData, session.user.id);
    } else {
      if (!requestedData?.name || !requestedData?.state) {
        return NextResponse.json({ message: "name and state are required" }, { status: 400 });
      }
      orgRequest = await orgRequestService.createLocationRequest(requestedData, session.user.id);
    }

    return NextResponse.json(orgRequest, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create org request", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
