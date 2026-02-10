import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";
import { UserRole } from "@/generated/prisma_client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";

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
    const hasAccess = await hasAccessToEmployee(userId, employeeId, userRole);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to view this employee" },
        { status: 403 },
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
        images: true,
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

  // Only Admins can edit employee records
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

    const formData = await request.formData();

    // Extract form fields
    const employeeId = parseInt(formData.get("employeeId") as string);
    const ticketId = parseInt(formData.get("ticketId") as string);
    const dateIssued = formData.get("dateIssued") as string;
    const licenseNumber = formData.get("licenseNumber") as string;
    const expiryDate = formData.get("expiryDate") as string;
    const imageFile = formData.get("image") as File | null;
    const removedImageIdsString = formData.get("removedImageIds") as string;
    const removedImageIds = removedImageIdsString
      ? JSON.parse(removedImageIdsString)
      : [];

    // Use existing values if new ones aren't provided
    const finalEmployeeId = employeeId || existingRecord.employeeId;
    const finalTicketId = ticketId || existingRecord.ticketId;
    const finalDateIssued = dateIssued
      ? new Date(dateIssued)
      : existingRecord.dateIssued;
    // Get ticket information for expiry calculation
    let ticket = null;
    if (ticketId || dateIssued) {
      ticket = await prisma.ticket.findUnique({
        where: { id: finalTicketId },
      });

      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }
    }

    // Handle expiry date logic
    let finalExpiryDate: Date | null = null;

    if (expiryDate) {
      // User provided explicit expiry date
      finalExpiryDate = new Date(expiryDate);
    } else if (ticket) {
      // No expiry date provided, calculate based on ticket type and issue date
      finalExpiryDate = calculateExpiryDate(finalDateIssued, ticket.renewal);
    } else {
      // Keep existing expiry date if no changes
      finalExpiryDate = existingRecord.expiryDate;
    }

    // Validate expiry date for tickets that should expire
    if (ticket && ticket.renewal !== null && !finalExpiryDate) {
      return NextResponse.json(
        {
          error: "Expiry date is required for tickets with renewal periods",
          code: "EXPIRY_DATE_REQUIRED",
        },
        { status: 400 },
      );
    }

    // Clear expiry date for tickets that never expire
    if (ticket && ticket.renewal && expiryDate === null) {
      finalExpiryDate = null;
    }

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

    // Verify that employee exists if being updated
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

    const imageFiles = formData.getAll("images") as File[];
    const savedImages: Array<{
      imagePath: string;
      imageType: string;
      originalName: string;
    }> = [];

    // Detect if images are removed and remove them
    if (removedImageIds.length > 0) {
      // Get the specific images to remove (for file cleanup)
      const imagesToRemove = await prisma.ticketImage.findMany({
        where: {
          id: { in: removedImageIds },
        },
      });

      // Delete the physical files
      for (const image of imagesToRemove) {
        try {
          const fullPath = path.join(process.cwd(), "uploads", image.imagePath);
          if (existsSync(fullPath)) {
            await unlink(fullPath);
          }
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }

      // Delete the database records
      await prisma.ticketImage.deleteMany({
        where: {
          id: { in: removedImageIds },
        },
      });
    }

    // Process new file uploads
    if (imageFiles.length > 0) {
      try {
        // Create upload directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), "uploads", "tickets");
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
        }

        // Process each file
        for (const imageFile of imageFiles) {
          if (imageFile && imageFile.size > 0) {
            // Validate file
            if (!FILE_UPLOAD_CONFIG.ALLOWED_TYPES.includes(imageFile.type)) {
              return NextResponse.json(
                {
                  error: `Invalid file type for ${imageFile.name}. Allowed types: ${FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY}`,
                },
                { status: 400 },
              );
            }

            if (imageFile.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
              return NextResponse.json(
                {
                  error: `File ${imageFile.name} is too large. Maximum size is ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY}`,
                },
                { status: 400 },
              );
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
            savedImages.push({
              imagePath: `tickets/${uniqueFilename}`,
              imageType: imageFile.type,
              originalName: imageFile.name,
            });
          }
        }
      } catch (fileError) {
        return NextResponse.json(
          {
            error: "Error saving files",
            details:
              fileError instanceof Error
                ? fileError.message
                : String(fileError),
          },
          { status: 500 },
        );
      }
    }

    // Update the ticket record
    const updatedRecord = await prisma.ticketRecords.update({
      where: { id },
      data: {
        employeeId: employeeId || undefined,
        ticketId: ticketId || undefined,
        dateIssued: dateIssued ? new Date(dateIssued) : undefined,
        expiryDate: finalExpiryDate,
        licenseNumber:
          licenseNumber !== undefined ? licenseNumber || null : undefined,
        // Remove the old imagePath and imageType fields
        ...(savedImages.length > 0 && {
          images: {
            create: savedImages.map((img) => ({
              imagePath: img.imagePath,
              imageType: img.imageType,
              originalName: img.originalName,
            })),
          },
        }),
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
        images: true, // Include images in response
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: updatedRecord.id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(existingRecord),
        newValues: JSON.stringify(updatedRecord),
        userId: session.user.id,
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

  // Only Admins can delete employee records
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
        images: true,
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

    // Clean up associated files
    if (existingRecord?.images && existingRecord.images.length > 0) {
      for (const image of existingRecord.images) {
        try {
          const filePath = path.join(process.cwd(), "uploads", image.imagePath);
          if (existsSync(filePath)) {
            await unlink(filePath);
          }
        } catch (cleanupError) {
          console.error(
            "Error cleaning up file during deletion:",
            cleanupError,
          );
        }
      }
    }

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(existingRecord),
        userId: session.user.id,
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
}
