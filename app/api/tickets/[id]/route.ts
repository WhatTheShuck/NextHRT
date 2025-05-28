import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET single ticket by ID
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
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        ticketRecords: {
          include: {
            ticketHolder: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
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

    // Check for duplicate ticket code if it's being updated
    if (json.ticketCode && json.ticketCode !== existingTicket.ticketCode) {
      const duplicateTicket = await prisma.ticket.findUnique({
        where: { ticketCode: json.ticketCode },
      });

      if (duplicateTicket) {
        return NextResponse.json(
          {
            error: "Ticket code already exists",
            code: "DUPLICATE_TICKET_CODE",
          },
          { status: 409 },
        );
      }
    }

    // Update the ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        ticketCode: json.ticketCode,
        ticketName: json.ticketName,
        renewal: json.renewal,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: updatedTicket.id,
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
        recordId: id,
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
