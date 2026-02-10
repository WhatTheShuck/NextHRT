import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET single ticket by ID with optional filtering
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

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const expirationDays = searchParams.get("expirationDays");
  const activeOnly = searchParams.get("activeOnly") === "true";
  const includeRequirements =
    searchParams.get("includeRequirements") === "true";
  try {
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Build the where clause for ticketRecords filtering
    const whereClause: any = {};
    // Add expiration filtering if provided
    if (expirationDays) {
      const days = parseInt(expirationDays);
      if (!isNaN(days)) {
        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);

        whereClause.expiryDate = {
          gt: now, // Must be in the future (not already expired)
          lte: cutoffDate, // Must expire within the specified days
          not: null, // Exclude records without expiry dates
        };
      }
    }
    if (activeOnly) {
      whereClause.ticketHolder = {
        isActive: true,
      };
    }
    const includeClause: any = {
      ticketRecords: {
        where: whereClause,

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
    };

    if (includeRequirements) {
      includeClause.requirements = {
        include: {
          ticket: true,
          department: true,
          location: true,
        },
      };
      includeClause.ticketExemptions = {
        include: {
          ticket: true,
          employee: true,
        },
      };
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: includeClause,
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
}

// PUT update ticket by ID
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

  const { id } = await params;

  const userRole = session.user.role as UserRole;

  // Only Admins can edit employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const json = await request.json();

    // Check if ticket exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Update the ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
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
        userId: session.user.id,
      },
    });

    if (json.requirements) {
      // Delete existing requirements
      await prisma.ticketRequirement.deleteMany({
        where: { ticketId: ticketId },
      });

      // Add new requirements
      for (const req of json.requirements) {
        await prisma.ticketRequirement.create({
          data: {
            ticketId: updatedTicket.id,
            departmentId: req.departmentId,
            locationId: req.locationId,
          },
        });
      }
    }

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
}

// DELETE ticket by ID
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

  const { id } = await params;
  const userRole = session.user.role as UserRole;

  // Only Admins can delete employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Check if ticket exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
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
      where: { id: ticketId },
    });
    // delete associate ticket requirements
    await prisma.ticketRequirement.deleteMany({
      where: { ticketId: ticketId },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: ticketId.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(existingTicket),
        userId: session.user.id,
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
}
