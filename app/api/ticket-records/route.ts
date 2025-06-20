import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

/**
 * Calculate expiry date based on issue date and ticket renewal period
 */
function calculateExpiryDate(
  dateIssued: Date,
  renewalYears: number | null,
): Date | null {
  if (renewalYears === null) {
    // Ticket never expires
    return null;
  }

  const expiryDate = new Date(dateIssued);
  expiryDate.setFullYear(expiryDate.getFullYear() + renewalYears);

  expiryDate.setDate(expiryDate.getDate());

  return expiryDate;
}

// GET all ticket records
export const GET = auth(async function GET(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const ticketRecords = await prisma.ticketRecords.findMany({
      include: {
        ticketHolder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: {
              select: {
                name: true,
              },
            },
            location: {
              select: {
                name: true,
                state: true,
              },
            },
          },
        },
        ticket: {
          select: {
            id: true,
            ticketCode: true,
            ticketName: true,
            renewal: true,
          },
        },
      },
      orderBy: [{ dateIssued: "desc" }, { ticketHolder: { lastName: "asc" } }],
    });

    return NextResponse.json(ticketRecords);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching ticket records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// POST new ticket record
export const POST = auth(async function POST(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await req.formData();

    // Extract form fields
    const employeeId = parseInt(formData.get("employeeId") as string);
    const ticketId = parseInt(formData.get("ticketId") as string);
    const dateIssued = formData.get("dateIssued") as string;
    const licenseNumber = formData.get("licenseNumber") as string;
    const imageFile = formData.get("image") as File | null;
    const expiryDate = formData.get("expiryDate") as string;
    const manualExpiryOverride =
      formData.get("manualExpiryOverride") === "true";

    // Validate required fields
    if (!employeeId || !ticketId || !dateIssued) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["employeeId", "ticketId", "dateIssued"],
        },
        { status: 400 },
      );
    }

    const issuedDate = new Date(dateIssued);

    // Check for duplicate based on unique constraint [employeeId, ticketId, dateIssued]
    const existingRecord = await prisma.ticketRecords.findFirst({
      where: {
        employeeId: employeeId,
        ticketId: ticketId,
        dateIssued: issuedDate,
      },
    });

    if (existingRecord) {
      return NextResponse.json(
        {
          error: "Duplicate ticket record found",
          code: "DUPLICATE_TICKET_RECORD",
          message:
            "A ticket record for this employee, ticket, and date already exists",
        },
        { status: 409 },
      );
    }

    // Verify that employee and ticket exist
    const [employee, ticket] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId } }),
      prisma.ticket.findUnique({ where: { id: ticketId } }),
    ]);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Process file upload if present
    let imagePath: string | null = null;
    let imageType: string | null = null;

    if (imageFile && imageFile.size > 0) {
      // Validate file
      if (!FILE_UPLOAD_CONFIG.ALLOWED_TYPES.includes(imageFile.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type. Allowed types: ${FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY}`,
          },
          { status: 400 },
        );
      }

      if (imageFile.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File too large. Maximum size is ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY}`,
          },
          { status: 400 },
        );
      }

      try {
        // Create upload directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), "uploads", "tickets");
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
        }

        // Generate unique filename
        const fileExtension = path.extname(imageFile.name);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadDir, uniqueFilename);

        // Convert file to buffer and save
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Store relative path for database
        imagePath = `tickets/${uniqueFilename}`;
        imageType = imageFile.type;
      } catch (fileError) {
        return NextResponse.json(
          {
            error: "Error saving file",
            details:
              fileError instanceof Error
                ? fileError.message
                : String(fileError),
          },
          { status: 500 },
        );
      }
    }

    // Handle expiry date calculation
    let finalExpiryDate: Date | null = null;

    if (manualExpiryOverride && expiryDate) {
      // User provided a manual expiry date
      finalExpiryDate = new Date(expiryDate);

      // Validate that manual expiry is after issue date
      if (finalExpiryDate <= issuedDate) {
        return NextResponse.json(
          {
            error: "Expiry date must be after the issue date",
            code: "INVALID_EXPIRY_DATE",
          },
          { status: 400 },
        );
      }
    } else {
      // Calculate expiry date based on ticket renewal period
      finalExpiryDate = calculateExpiryDate(issuedDate, ticket.renewal);
    }

    // For tickets that should have expiry dates, ensure we have one
    if (ticket.renewal !== null && !finalExpiryDate) {
      return NextResponse.json(
        {
          error: "Expiry date is required for tickets with renewal periods",
          code: "EXPIRY_DATE_REQUIRED",
        },
        { status: 400 },
      );
    }

    // For tickets that never expire, clear any expiry date
    if (ticket.renewal === null) {
      finalExpiryDate = null;
    }

    // Create the ticket record
    const ticketRecord = await prisma.ticketRecords.create({
      data: {
        employeeId: employeeId,
        ticketId: ticketId,
        dateIssued: issuedDate,
        expiryDate: finalExpiryDate,
        licenseNumber: licenseNumber || null,
        imagePath: imagePath,
        imageType: imageType,
      },
      include: {
        ticketHolder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: {
              select: {
                name: true,
              },
            },
            location: {
              select: {
                name: true,
                state: true,
              },
            },
          },
        },
        ticket: {
          select: {
            id: true,
            ticketCode: true,
            ticketName: true,
            renewal: true,
          },
        },
      },
    });

    // Create history record with additional context for manual overrides
    const historyData = {
      ...ticketRecord,
      _metadata: {
        manualExpiryOverride,
        calculatedExpiryDate:
          ticket.renewal !== null
            ? calculateExpiryDate(issuedDate, ticket.renewal)?.toISOString() ||
              null
            : null,
        finalExpiryDate: finalExpiryDate?.toISOString() || null,
      },
    };

    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: ticketRecord.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(historyData),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(ticketRecord);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error creating ticket record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
