import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { exemptionService } from "@/lib/services/exemptionService";

// GET specific exemption record
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
  const userRole = session.user.role as UserRole;
  const userId = session.user.id;
  const exemptionId = parseInt(id);

  if (isNaN(exemptionId)) {
    return NextResponse.json(
      { error: "Invalid exemption ID" },
      { status: 400 },
    );
  }

  try {
    const exemption = await exemptionService.getExemptionById(
      exemptionId,
      userRole,
      userId,
    );
    return NextResponse.json(exemption);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EXEMPTION_NOT_FOUND":
          return NextResponse.json(
            { message: "Exemption record not found" },
            { status: 404 },
          );
        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 },
          );
        case "NOT_AUTHORISED":
          return NextResponse.json(
            { message: "Not authorised to view this record" },
            { status: 403 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching exemption record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update specific exemption record
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
  const exemptionId = parseInt(id);

  const canEdit = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { exemption: ["edit"] } },
  });

  if (!canEdit) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  if (isNaN(exemptionId)) {
    return NextResponse.json(
      { error: "Invalid exemption ID" },
      { status: 400 },
    );
  }

  try {
    const json = await request.json();
    const updatedExemption = await exemptionService.updateExemption(
      exemptionId,
      json,
      session.user.id,
    );
    return NextResponse.json(updatedExemption);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EXEMPTION_NOT_FOUND":
          return NextResponse.json(
            { message: "Exemption record not found" },
            { status: 404 },
          );
        case "INVALID_TYPE":
          return NextResponse.json(
            { error: "Type must be either 'Ticket' or 'Training'" },
            { status: 400 },
          );
        case "END_DATE_BEFORE_START":
          return NextResponse.json(
            { error: "End date must be after start date" },
            { status: 400 },
          );
        case "DUPLICATE_EXEMPTION":
          return NextResponse.json(
            {
              error: "Duplicate exemption record found",
              code: "DUPLICATE_EXEMPTION_RECORD",
            },
            { status: 409 },
          );
      }
      if (error.message.startsWith("INVALID_DATE_")) {
        return NextResponse.json(
          { error: `Invalid ${error.message.replace("INVALID_DATE_", "").toLowerCase()} format` },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      {
        error: "Error updating exemption record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

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
  const exemptionId = parseInt(id);

  const canDelete = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { exemption: ["delete"] } },
  });

  if (!canDelete) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  if (isNaN(exemptionId)) {
    return NextResponse.json(
      { error: "Invalid exemption ID" },
      { status: 400 },
    );
  }

  try {
    const result = await exemptionService.deleteExemption(
      exemptionId,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EXEMPTION_NOT_FOUND":
          return NextResponse.json(
            { message: "Exemption record not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting exemption record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
