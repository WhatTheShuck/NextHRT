import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAccessToEmployee } from "@/lib/apiRBAC";
import { requirementService } from "@/lib/services/requirementService";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const departmentIdParam = searchParams.get("departmentId");
  const locationIdParam = searchParams.get("locationId");
  const employeeIdParam = searchParams.get("employeeId");
  const trainingIdParam = searchParams.get("trainingId");
  const ticketIdParam = searchParams.get("ticketId");
  const allIncompleteTraining = searchParams.get("allIncompleteTraining");
  const allIncompleteTickets = searchParams.get("allIncompleteTickets");

  // Handle bulk incomplete training
  if (allIncompleteTraining === "true") {
    try {
      const result =
        await requirementService.getAllIncompleteTrainingRequirements();
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: "Error fetching incomplete training requirements" },
        { status: 500 },
      );
    }
  }

  // Handle bulk incomplete tickets
  if (allIncompleteTickets === "true") {
    try {
      const result =
        await requirementService.getAllIncompleteTicketRequirements();
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: "Error fetching incomplete ticket requirements" },
        { status: 500 },
      );
    }
  }

  // Handle individual employee requirements
  if (employeeIdParam) {
    const employeeId = parseInt(employeeIdParam);
    if (isNaN(employeeId)) {
      return NextResponse.json(
        { error: "Invalid employeeId parameter" },
        { status: 400 },
      );
    }

    const hasAccess = await hasAccessToEmployee(session.user.id, employeeId, session.user.role as string);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to view this employee" },
        { status: 403 },
      );
    }

    try {
      const result =
        await requirementService.getEmployeeRequirements(employeeId);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case "EMPLOYEE_NOT_FOUND":
            return NextResponse.json(
              { error: "Employee not found" },
              { status: 404 },
            );
        }
      }
      return NextResponse.json(
        { error: "Error fetching requirements" },
        { status: 500 },
      );
    }
  }

  if (trainingIdParam) {
    const trainingId = parseInt(trainingIdParam);
    if (isNaN(trainingId)) {
      return NextResponse.json(
        { error: "Invalid trainingId parameter" },
        { status: 400 },
      );
    }

    try {
      const result =
        await requirementService.getTrainingRequirements(trainingId);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case "TRAINING_NOT_FOUND":
            return NextResponse.json(
              { error: "Training not found" },
              { status: 404 },
            );
          case "NO_REQUIREMENTS_FOUND":
            return NextResponse.json(
              { error: "No requirements found for this training" },
              { status: 404 },
            );
        }
      }
      return NextResponse.json(
        { error: "Error fetching training requirements" },
        { status: 500 },
      );
    }
  }

  if (ticketIdParam) {
    const ticketId = parseInt(ticketIdParam);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: "Invalid trainingId parameter" },
        { status: 400 },
      );
    }

    try {
      const result = await requirementService.getTicketRequirements(ticketId);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case "TICKET_NOT_FOUND":
            return NextResponse.json(
              { error: "Training not found" },
              { status: 404 },
            );
          case "NO_REQUIREMENTS_FOUND":
            return NextResponse.json(
              { error: "No requirements found for this ticket" },
              { status: 404 },
            );
        }
      }
      return NextResponse.json(
        { error: "Error fetching training requirements" },
        { status: 500 },
      );
    }
  }

  // Handle department/location requirements
  if (departmentIdParam !== null && locationIdParam !== null) {
    const departmentId = parseInt(departmentIdParam);
    const locationId = parseInt(locationIdParam);

    if (isNaN(departmentId) || isNaN(locationId)) {
      return NextResponse.json(
        { error: "Invalid departmentId or locationId parameter" },
        { status: 400 },
      );
    }

    try {
      const result =
        await requirementService.getDepartmentLocationRequirements(
          departmentId,
          locationId,
        );
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case "DEPARTMENT_NOT_FOUND":
            return NextResponse.json(
              { error: "Department not found" },
              { status: 404 },
            );
          case "LOCATION_NOT_FOUND":
            return NextResponse.json(
              { error: "Location not found" },
              { status: 404 },
            );
        }
      }
      return NextResponse.json(
        { error: "Error fetching requirements" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    {
      error:
        "Missing required parameters. Provide either employeeId, or both departmentId and locationId",
    },
    { status: 400 },
  );
}
