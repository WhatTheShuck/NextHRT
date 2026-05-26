import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { trainingCourseRequestService } from "@/lib/services/trainingCourseRequestService";

export async function POST(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const { name, description } = await request.json();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const result = await trainingCourseRequestService.submitCourseRequest(
      name,
      description,
      session.user.id,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to submit course request" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    // Admin sees all; others see only their own
    const options =
      session.user.role === "Admin" ? {} : { requestedByUserId: session.user.id };
    const results = await trainingCourseRequestService.getCourseRequests(options);
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch course requests" }, { status: 500 });
  }
}
