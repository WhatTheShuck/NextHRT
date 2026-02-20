import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { ticketService } from "@/lib/services/ticketService";

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

    const ticket = await ticketService.getTicketById(ticketId, {
      activeOnly,
      expirationDays:
        expirationDays && !isNaN(parseInt(expirationDays))
          ? parseInt(expirationDays)
          : null,
      includeRequirements,
    });
    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TICKET_NOT_FOUND":
          return NextResponse.json(
            { error: "Ticket not found" },
            { status: 404 },
          );
      }
    }
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

  const canEdit = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { ticket: ["edit"] } },
  });

  if (!canEdit) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const json = await request.json();
    const updatedTicket = await ticketService.updateTicket(
      ticketId,
      json,
      session.user.id,
    );
    return NextResponse.json(updatedTicket);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TICKET_NOT_FOUND":
          return NextResponse.json(
            { error: "Ticket not found" },
            { status: 404 },
          );
      }
    }
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

  const canDelete = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { ticket: ["delete"] } },
  });

  if (!canDelete) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const result = await ticketService.deleteTicket(ticketId, session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TICKET_NOT_FOUND":
          return NextResponse.json(
            { error: "Ticket not found" },
            { status: 404 },
          );
        case "TICKET_HAS_RECORDS":
          return NextResponse.json(
            {
              error: "Cannot delete ticket with existing ticket records",
              code: "TICKET_HAS_RECORDS",
            },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting ticket",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
