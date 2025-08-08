import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET single ticket by ID with optional filtering
export const GET = auth(async function GET(
  req,
  props: { params: Promise<{ id: string }> },
) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const { searchParams } = new URL(req.url);
  const expirationDays = searchParams.get("expirationDays");
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Build the where clause for ticketRecords filtering
    let ticketRecordsWhere: any = {};

    // Add expiration filtering if provided
    if (expirationDays) {
      const days = parseInt(expirationDays);
      if (!isNaN(days)) {
        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);

        ticketRecordsWhere.expiryDate = {
          gt: now, // Must be in the future (not already expired)
          lte: cutoffDate, // Must expire within the specified days
          not: null, // Exclude records without expiry dates
        };
      }
    }
    if (activeOnly) {
      ticketRecordsWhere.ticketHolder = {
        isActive: true,
      };
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        ticketRecords: {
          where:
            Object.keys(ticketRecordsWhere).length > 0
              ? ticketRecordsWhere
              : undefined,
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
                  },
                },
              },
            },
          },
          orderBy: {
            dateIssued: "desc",
          },
        },
        _count: {
          select: {
            ticketRecords: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching ticket",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PUT update ticket by ID
export const PUT = auth(async function PUT(
  req,
  props: { params: Promise<{ id: string }> },
) {
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;

  const userRole = req.auth.user?.role as UserRole;

  // Only Admins can edit employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const json = await req.json();

    // Check if ticket exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Update the ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        ticketCode: json.ticketCode,
        ticketName: json.ticketName,
        renewal: json.renewal,
        isActive: json.isActive,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: updatedTicket.id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(existingTicket),
        newValues: JSON.stringify(updatedTicket),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(updatedTicket);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating ticket",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// DELETE ticket by ID
export const DELETE = auth(async function DELETE(
  req,
  props: { params: Promise<{ id: string }> },
) {
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userRole = req.auth.user?.role as UserRole;

  // Only Admins can delete employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Check if ticket exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ticketRecords: true,
          },
        },
      },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check if ticket has associated records
    if (existingTicket._count.ticketRecords > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete ticket with existing ticket records",
          code: "TICKET_HAS_RECORDS",
          recordCount: existingTicket._count.ticketRecords,
        },
        { status: 409 },
      );
    }

    // Delete the ticket
    await prisma.ticket.delete({
      where: { id },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(existingTicket),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json({
      message: "Ticket deleted successfully",
      deletedTicket: existingTicket,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting ticket",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
