import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
    const json = await req.json();

    // Validate required fields
    if (!json.employeeId || !json.ticketId || !json.dateIssued) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["employeeId", "ticketId", "dateIssued"],
        },
        { status: 400 },
      );
    }

    // Check for duplicate based on unique constraint [employeeId, ticketId, dateIssued]
    const existingRecord = await prisma.ticketRecords.findFirst({
      where: {
        employeeId: json.employeeId,
        ticketId: json.ticketId,
        dateIssued: new Date(json.dateIssued),
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
      prisma.employee.findUnique({ where: { id: json.employeeId } }),
      prisma.ticket.findUnique({ where: { id: json.ticketId } }),
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

    // Create the ticket record
    const ticketRecord = await prisma.ticketRecords.create({
      data: {
        employeeId: json.employeeId,
        ticketId: json.ticketId,
        dateIssued: new Date(json.dateIssued),
        licenseNumber: json.licenseNumber || null,
        imagePath: json.imagePath || null,
        imageType: json.imageType || null,
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

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: ticketRecord.id,
        action: "CREATE",
        newValues: JSON.stringify(ticketRecord),
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
