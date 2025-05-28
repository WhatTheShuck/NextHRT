import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const json = await req.json();

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

    // Check for duplicate if key fields are being changed
    const employeeId = json.employeeId ?? existingRecord.employeeId;
    const ticketId = json.ticketId ?? existingRecord.ticketId;
    const dateIssued = json.dateIssued
      ? new Date(json.dateIssued)
      : existingRecord.dateIssued;

    // Only check for duplicates if at least one of the unique constraint fields is changing
    const isUniqueFieldChanged =
      (json.employeeId !== undefined &&
        json.employeeId !== existingRecord.employeeId) ||
      (json.ticketId !== undefined &&
        json.ticketId !== existingRecord.ticketId) ||
      (json.dateIssued !== undefined &&
        new Date(json.dateIssued).getTime() !==
          existingRecord.dateIssued.getTime());

    if (isUniqueFieldChanged) {
      const duplicateRecord = await prisma.ticketRecords.findFirst({
        where: {
          employeeId,
          ticketId,
          dateIssued,
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
    if (json.employeeId && json.employeeId !== existingRecord.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: json.employeeId },
      });
      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 },
        );
      }
    }

    if (json.ticketId && json.ticketId !== existingRecord.ticketId) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: json.ticketId },
      });
      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }
    }

    // Update the ticket record
    const updatedRecord = await prisma.ticketRecords.update({
      where: { id },
      data: {
        employeeId: json.employeeId,
        ticketId: json.ticketId,
        dateIssued: json.dateIssued ? new Date(json.dateIssued) : undefined,
        licenseNumber:
          json.licenseNumber !== undefined ? json.licenseNumber : undefined,
        imagePath: json.imagePath !== undefined ? json.imagePath : undefined,
        imageType: json.imageType !== undefined ? json.imageType : undefined,
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

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: updatedRecord.id,
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
