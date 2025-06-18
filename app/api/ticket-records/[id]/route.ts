import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

// GET single ticket record by ID
export const GET = auth(async function GET(
  req,
  props: { params: Promise<{ id: string }> },
) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;

  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ticket record ID" },
        { status: 400 },
      );
    }

    const ticketRecord = await prisma.ticketRecords.findUnique({
      where: { id },
      include: {
        ticketHolder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            location: {
              select: {
                id: true,
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

    if (!ticketRecord) {
      return NextResponse.json(
        { error: "Ticket record not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(ticketRecord);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching ticket record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PUT update ticket record by ID
export const PUT = auth(async function PUT(
  req,
  props: { params: Promise<{ id: string }> },
) {
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;

  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ticket record ID" },
        { status: 400 },
      );
    }

    // Check if ticket record exists
    const existingRecord = await prisma.ticketRecords.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Ticket record not found" },
        { status: 404 },
      );
    }

    const formData = await req.formData();

    // Extract form fields
    const employeeId = parseInt(formData.get("employeeId") as string);
    const ticketId = parseInt(formData.get("ticketId") as string);
    const dateIssued = formData.get("dateIssued") as string;
    const licenseNumber = formData.get("licenseNumber") as string;
    const imageFile = formData.get("image") as File | null;
    const removeImage = formData.get("removeImage") === "true"; // Flag to remove existing image

    // Use existing values if new ones aren't provided
    const finalEmployeeId = employeeId || existingRecord.employeeId;
    const finalTicketId = ticketId || existingRecord.ticketId;
    const finalDateIssued = dateIssued
      ? new Date(dateIssued)
      : existingRecord.dateIssued;

    // Check for duplicate if key fields are being changed
    const isUniqueFieldChanged =
      (employeeId && employeeId !== existingRecord.employeeId) ||
      (ticketId && ticketId !== existingRecord.ticketId) ||
      (dateIssued &&
        new Date(dateIssued).getTime() !== existingRecord.dateIssued.getTime());

    if (isUniqueFieldChanged) {
      const duplicateRecord = await prisma.ticketRecords.findFirst({
        where: {
          employeeId: finalEmployeeId,
          ticketId: finalTicketId,
          dateIssued: finalDateIssued,
          NOT: { id }, // Exclude current record
        },
      });

      if (duplicateRecord) {
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
    }

    // Verify that employee and ticket exist if they're being updated
    if (employeeId && employeeId !== existingRecord.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });
      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 },
        );
      }
    }

    let ticket = null;
    if (ticketId && ticketId !== existingRecord.ticketId) {
      ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });
      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }
    } else if (ticketId || dateIssued) {
      // We need ticket info for expiry calculation
      ticket = await prisma.ticket.findUnique({
        where: { id: finalTicketId },
      });
    }

    // Handle file operations
    let imagePath: string | null = existingRecord.imagePath;
    let imageType: string | null = existingRecord.imageType;
    let oldImagePath: string | null = null;

    // If removing image or uploading new one, prepare to delete old file
    if (removeImage || (imageFile && imageFile.size > 0)) {
      oldImagePath = existingRecord.imagePath;
      imagePath = null;
      imageType = null;
    }

    // Process new file upload if present
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

    // Calculate expiry date if ticket or date changed (renewal period in years)
    let expiryDate: Date | null = existingRecord.expiryDate;
    if (ticket && (ticketId || dateIssued)) {
      if (ticket.renewal !== null) {
        expiryDate = new Date(finalDateIssued);
        expiryDate.setFullYear(expiryDate.getFullYear() + ticket.renewal);
      } else {
        expiryDate = null;
      }
    }

    // Update the ticket record
    const updatedRecord = await prisma.ticketRecords.update({
      where: { id },
      data: {
        employeeId: employeeId || undefined,
        ticketId: ticketId || undefined,
        dateIssued: dateIssued ? new Date(dateIssued) : undefined,
        expiryDate: ticketId || dateIssued ? expiryDate : undefined,
        licenseNumber:
          licenseNumber !== undefined ? licenseNumber || null : undefined,
        imagePath:
          imagePath !== existingRecord.imagePath ? imagePath : undefined,
        imageType:
          imageType !== existingRecord.imageType ? imageType : undefined,
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
                id: true,
                name: true,
              },
            },
            location: {
              select: {
                id: true,
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

    // Clean up old file if it was replaced or removed
    if (oldImagePath) {
      try {
        const oldFullPath = path.join(process.cwd(), "uploads", oldImagePath);
        if (existsSync(oldFullPath)) {
          await unlink(oldFullPath);
        }
      } catch (cleanupError) {
        // Log error but don't fail the request
        console.error("Error cleaning up old file:", cleanupError);
      }
    }

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: updatedRecord.id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(existingRecord),
        newValues: JSON.stringify(updatedRecord),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(updatedRecord);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating ticket record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// DELETE ticket record by ID
export const DELETE = auth(async function DELETE(
  req,
  props: { params: Promise<{ id: string }> },
) {
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;

  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ticket record ID" },
        { status: 400 },
      );
    }

    // Check if ticket record exists
    const existingRecord = await prisma.ticketRecords.findUnique({
      where: { id },
      include: {
        ticketHolder: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        ticket: {
          select: {
            ticketCode: true,
            ticketName: true,
          },
        },
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Ticket record not found" },
        { status: 404 },
      );
    }

    // Delete the ticket record
    await prisma.ticketRecords.delete({
      where: { id },
    });

    // Clean up associated file if it exists
    if (existingRecord.imagePath) {
      try {
        const filePath = path.join(
          process.cwd(),
          "uploads",
          existingRecord.imagePath,
        );
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch (cleanupError) {
        // Log error but don't fail the request since record is already deleted
        console.error("Error cleaning up file during deletion:", cleanupError);
      }
    }

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: id,
        action: "DELETE",
        oldValues: JSON.stringify(existingRecord),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json({
      message: "Ticket record deleted successfully",
      deletedRecord: {
        id: existingRecord.id,
        employee: `${existingRecord.ticketHolder.firstName} ${existingRecord.ticketHolder.lastName}`,
        ticket: `${existingRecord.ticket.ticketCode} - ${existingRecord.ticket.ticketName}`,
        dateIssued: existingRecord.dateIssued,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting ticket record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
