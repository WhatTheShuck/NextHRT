import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { exemptionService } from "@/lib/services/exemptionService";

// GET all exemption records
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;
  const userId = session.user.id;

  try {
    const exemptions = await exemptionService.getExemptions({
      userRole,
      userId,
    });
    return NextResponse.json(exemptions);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 },
          );
        case "NO_EMPLOYEE_RECORD":
          return NextResponse.json(
            { message: "No associated employee record" },
            { status: 403 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching ticket records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST new exemption record
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;

  const canCreate = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { exemption: ["create"] } },
  });

  if (!canCreate) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const exemption = await exemptionService.createExemption(
      json,
      session.user.id,
    );
    return NextResponse.json(exemption);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "INVALID_TYPE":
          return NextResponse.json(
            { error: "Type must be either 'Ticket' or 'Training'" },
            { status: 400 },
          );
        case "MISSING_EMPLOYEE_ID":
          return NextResponse.json(
            { error: "Employee ID is required" },
            { status: 400 },
          );
        case "MISSING_TICKET_ID":
          return NextResponse.json(
            { error: "Ticket ID is required when type is 'Ticket'" },
            { status: 400 },
          );
        case "MISSING_TRAINING_ID":
          return NextResponse.json(
            { error: "Training ID is required when type is 'Training'" },
            { status: 400 },
          );
        case "END_DATE_BEFORE_START":
          return NextResponse.json(
            { error: "End date must be after start date" },
            { status: 400 },
          );
        case "DUPLICATE_EXEMPTION":
          return NextResponse.json(
            {
              error: "Duplicate exemption record found",
              code: "DUPLICATE_EXEMPTION_RECORD",
            },
            { status: 409 },
          );
        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            { error: "Employee not found" },
            { status: 404 },
          );
        case "TICKET_NOT_FOUND":
          return NextResponse.json(
            { error: "Ticket not found" },
            { status: 404 },
          );
        case "TRAINING_NOT_FOUND":
          return NextResponse.json(
            { error: "Training not found" },
            { status: 404 },
          );
      }
      if (error.message.startsWith("INVALID_DATE_")) {
        return NextResponse.json(
          { error: `Invalid ${error.message.replace("INVALID_DATE_", "").toLowerCase()} format` },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      {
        error: "Error creating ticket record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
