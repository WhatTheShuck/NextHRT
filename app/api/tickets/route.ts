import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET all tickets
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const includeRequirements =
    searchParams.get("includeRequirements") === "true";

  const whereClause: any = {};
  if (activeOnly) {
    whereClause.isActive = true;
  }

  const includeClause: any = {
    _count: {
      select: { ticketRecords: true },
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
  try {
    const tickets = await prisma.ticket.findMany({
      include: includeClause,
      where: whereClause,
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
}

// POST new ticket
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;

  // Only Admins can create employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }
  try {
    const json = await request.json();

    // we don't care about unique ticket code for now
    // // Check for duplicate ticket code
    // const existingTicket = await prisma.ticket.findUnique({
    //   where: { ticketCode: json.ticketCode },
    // });

    // if (existingTicket) {
    //   return NextResponse.json(
    //     {
    //       error: "Ticket code already exists",
    //       code: "DUPLICATE_TICKET_CODE",
    //     },
    //     { status: 409 },
    //   );
    // }

    // Create the ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketCode: json.ticketCode,
        ticketName: json.ticketName,
        renewal: json.renewal ?? null,
      },
    });
    if (json.requirements) {
      for (const req of json.requirements) {
        await prisma.ticketRequirement.create({
          data: {
            ticketId: ticket.id,
            departmentId: req.departmentId,
            locationId: req.locationId,
          },
        });
      }
    }

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: ticket.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(ticket),
        userId: session.user.id,
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
}
