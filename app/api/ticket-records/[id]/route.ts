import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";
import { ticketRecordService } from "@/lib/services/ticketRecordService";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

// GET single ticket record by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const userId = session.user.id;
  const userRole = session.user.role as UserRole;
  const employeeId = parseInt(idParam);

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ticket record ID" },
        { status: 400 },
      );
    }

    // Check if user has access to this employee
    const hasAccess = await hasAccessToEmployee(userId, employeeId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to view this employee" },
        { status: 403 },
      );
    }

    const ticketRecord = await ticketRecordService.getTicketRecordById(id);
    return NextResponse.json(ticketRecord);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TICKET_RECORD_NOT_FOUND":
          return NextResponse.json(
            { error: "Ticket record not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching ticket record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update ticket record by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const userRole = session.user.role as UserRole;

  // Only Admins can edit ticket records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ticket record ID" },
        { status: 400 },
      );
    }

    const formData = await request.formData();

    const employeeId = formData.get("employeeId");
    const ticketId = formData.get("ticketId");
    const removedImageIdsString = formData.get("removedImageIds") as string;

    const data = {
      employeeId: employeeId ? parseInt(employeeId as string) : undefined,
      ticketId: ticketId ? parseInt(ticketId as string) : undefined,
      dateIssued: (formData.get("dateIssued") as string) || undefined,
      licenseNumber: formData.get("licenseNumber") as string,
      expiryDate: formData.get("expiryDate") as string | null,
      removedImageIds: removedImageIdsString
        ? JSON.parse(removedImageIdsString)
        : [],
    };
    const imageFiles = formData.getAll("images") as File[];

    const updatedRecord = await ticketRecordService.updateTicketRecord(
      id,
      data,
      imageFiles,
      session.user.id,
    );
    return NextResponse.json(updatedRecord);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TICKET_RECORD_NOT_FOUND":
          return NextResponse.json(
            { error: "Ticket record not found" },
            { status: 404 },
          );
        case "TICKET_NOT_FOUND":
          return NextResponse.json(
            { error: "Ticket not found" },
            { status: 404 },
          );
        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            { error: "Employee not found" },
            { status: 404 },
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
        error: "Error updating ticket record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE ticket record by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const userRole = session.user.role as UserRole;

  // Only Admins can delete ticket records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ticket record ID" },
        { status: 400 },
      );
    }

    const result = await ticketRecordService.deleteTicketRecord(
      id,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TICKET_RECORD_NOT_FOUND":
          return NextResponse.json(
            { error: "Ticket record not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting ticket record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
