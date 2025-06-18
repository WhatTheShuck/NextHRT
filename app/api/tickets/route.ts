import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET all tickets
export const GET = auth(async function GET(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        ticketRecords: {
          include: {
            ticketHolder: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            ticketRecords: true,
          },
        },
      },
      orderBy: {
        ticketName: "asc",
      },
    });

    return NextResponse.json(tickets);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching tickets",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// POST new ticket
export const POST = auth(async function POST(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const json = await req.json();

    // Check for duplicate ticket code
    const existingTicket = await prisma.ticket.findUnique({
      where: { ticketCode: json.ticketCode },
    });

    if (existingTicket) {
      return NextResponse.json(
        {
          error: "Ticket code already exists",
          code: "DUPLICATE_TICKET_CODE",
        },
        { status: 409 },
      );
    }

    // Create the ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketCode: json.ticketCode,
        ticketName: json.ticketName,
        renewal: json.renewal ?? null,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: ticket.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(ticket),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error creating ticket",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
