import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { ticketRecordService } from "@/lib/services/ticketRecordService";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

// GET all ticket records
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const includeExpired = searchParams.get("includeExpired") === "true";
  const userRole = session.user.role as UserRole;
  const userId = session.user.id;

  try {
    const ticketRecords = await ticketRecordService.getTicketRecords({
      activeOnly,
      includeExpired,
      userRole,
      userId,
    });
    return NextResponse.json(ticketRecords);
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

// POST new ticket record
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;

  const canCreate = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { ticketRecord: ["create"] } },
  });

  if (!canCreate) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const formData = await request.formData();

    const data = {
      employeeId: parseInt(formData.get("employeeId") as string),
      ticketId: parseInt(formData.get("ticketId") as string),
      dateIssued: formData.get("dateIssued") as string,
      licenseNumber: formData.get("licenseNumber") as string,
      expiryDate: formData.get("expiryDate") as string,
      manualExpiryOverride:
        formData.get("manualExpiryOverride") === "true",
    };
    const imageFiles = formData.getAll("images") as File[];

    const ticketRecord = await ticketRecordService.createTicketRecord(
      data,
      imageFiles,
      session.user.id,
    );
    return NextResponse.json(ticketRecord);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "MISSING_REQUIRED_FIELDS":
          return NextResponse.json(
            {
              error: "Missing required fields",
              required: ["employeeId", "ticketId", "dateIssued"],
            },
            { status: 400 },
          );
        case "DUPLICATE_TICKET_RECORD":
          return NextResponse.json(
            {
              error: "Duplicate ticket record found",
              code: "DUPLICATE_TICKET_RECORD",
              message:
                "A ticket record for this employee, ticket, and date already exists",
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
        case "INVALID_EXPIRY_DATE":
          return NextResponse.json(
            {
              error: "Expiry date must be after the issue date",
              code: "INVALID_EXPIRY_DATE",
            },
            { status: 400 },
          );
        case "EXPIRY_DATE_REQUIRED":
          return NextResponse.json(
            {
              error:
                "Expiry date is required for tickets with renewal periods",
              code: "EXPIRY_DATE_REQUIRED",
            },
            { status: 400 },
          );
        case "INVALID_FILE_TYPE":
          return NextResponse.json(
            {
              error: `Invalid file type. Allowed types: ${FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY}`,
            },
            { status: 400 },
          );
        case "FILE_TOO_LARGE":
          return NextResponse.json(
            {
              error: `File too large. Maximum size is ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY}`,
            },
            { status: 400 },
          );
        case "FILE_SAVE_ERROR":
          return NextResponse.json(
            { error: "Error saving files" },
            { status: 500 },
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
