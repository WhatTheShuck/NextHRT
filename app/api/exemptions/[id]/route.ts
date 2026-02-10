import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

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
    const exemption = await prisma.trainingTicketExemption.findUnique({
      where: { id: exemptionId },
      include: {
        training: true,
        ticket: true,
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
      },
    });

    if (!exemption) {
      return NextResponse.json(
        { message: "Exemption record not found" },
        { status: 404 },
      );
    }

    // Check access permissions based on user role
    if (userRole === "Admin") {
      // Admins can see all records
      return NextResponse.json(exemption);
    } else if (userRole === "DepartmentManager") {
      // Department managers can see employees in their departments
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { managedDepartments: true },
      });

      if (!user) {
        return NextResponse.json(
          { message: "User not found" },
          { status: 404 },
        );
      }

      const departmentIds = user.managedDepartments.map((dept) => dept.id);

      if (!departmentIds.includes(exemption.employee.departmentId)) {
        return NextResponse.json(
          { message: "Not authorised to view this record" },
          { status: 403 },
        );
      }

      return NextResponse.json(exemption);
    } else {
      // Regular users can only see their own records
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true },
      });

      if (
        !user ||
        !user.employee ||
        user.employee.id !== exemption.employeeId
      ) {
        return NextResponse.json(
          { message: "Not authorised to view this record" },
          { status: 403 },
        );
      }

      return NextResponse.json(exemption);
    }
  } catch (error) {
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

  // Only Admins can update exemption records
  if (userRole !== "Admin") {
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

    // Check if exemption exists
    const existingExemption = await prisma.trainingTicketExemption.findUnique({
      where: { id: exemptionId },
    });

    if (!existingExemption) {
      return NextResponse.json(
        { message: "Exemption record not found" },
        { status: 404 },
      );
    }

    // Validate type if provided
    if (json.type && json.type !== "Ticket" && json.type !== "Training") {
      return NextResponse.json(
        { error: "Type must be either 'Ticket' or 'Training'" },
        { status: 400 },
      );
    }

    // Helper function for date validation
    const validateDate = (dateString: string, fieldName: string) => {
      if (!dateString) return null;

      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid ${fieldName} format`);
      }
      return date;
    };

    // Date validation with proper error handling
    const startDate = json.startDate
      ? validateDate(json.startDate, "start date")
      : null;
    const endDate = json.endDate
      ? validateDate(json.endDate, "end date")
      : null;

    // Validate end date is after start date
    const effectiveStartDate = startDate || existingExemption.startDate;
    if (endDate && effectiveStartDate && endDate <= effectiveStartDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }

    // Check for duplicate if changing key fields
    if (json.employeeId || json.type || json.ticketId || json.trainingId) {
      const whereCondition: any = {
        employeeId: json.employeeId || existingExemption.employeeId,
        id: { not: exemptionId }, // Exclude current record
      };

      const type = json.type || existingExemption.type;
      if (type === "Ticket") {
        whereCondition.ticketId = json.ticketId || existingExemption.ticketId;
        whereCondition.trainingId = null;
      } else {
        whereCondition.trainingId =
          json.trainingId || existingExemption.trainingId;
        whereCondition.ticketId = null;
      }

      const duplicateRecord = await prisma.trainingTicketExemption.findFirst({
        where: whereCondition,
      });

      if (duplicateRecord) {
        return NextResponse.json(
          {
            error: "Duplicate exemption record found",
            code: "DUPLICATE_EXEMPTION_RECORD",
            message: `An exemption record for this employee and ${type.toLowerCase()} already exists`,
          },
          { status: 409 },
        );
      }
    }

    // Update the exemption with inline data building
    const updatedExemption = await prisma.trainingTicketExemption.update({
      where: { id: exemptionId },
      data: {
        // Only include fields that are actually being updated
        ...(json.reason !== undefined && { reason: json.reason }),
        ...(json.status !== undefined && { status: json.status }),
        ...(startDate !== null && { startDate }),
        ...(json.endDate !== undefined && { endDate }),
        ...(json.employeeId !== undefined && { employeeId: json.employeeId }),

        // Handle type changes
        ...(json.type &&
          json.type !== existingExemption.type && {
            type: json.type,
            ...(json.type === "Ticket"
              ? { ticketId: json.ticketId, trainingId: null }
              : { trainingId: json.trainingId, ticketId: null }),
          }),

        // Handle ID updates without type change
        ...((!json.type || json.type === existingExemption.type) && {
          ...(json.ticketId !== undefined && { ticketId: json.ticketId }),
          ...(json.trainingId !== undefined && { trainingId: json.trainingId }),
        }),
      },
      include: {
        training: true,
        ticket: true,
        employee: true,
      },
    });

    // Log the change (get changed fields from the update data)
    const changedFields = Object.keys({
      ...(json.reason !== undefined && { reason: true }),
      ...(json.status !== undefined && { status: true }),
      ...(startDate !== null && { startDate: true }),
      ...(json.endDate !== undefined && { endDate: true }),
      ...(json.employeeId !== undefined && { employeeId: true }),
      ...(json.type &&
        json.type !== existingExemption.type && {
          type: true,
          ticketId: true,
          trainingId: true,
        }),
      ...((!json.type || json.type === existingExemption.type) && {
        ...(json.ticketId !== undefined && { ticketId: true }),
        ...(json.trainingId !== undefined && { trainingId: true }),
      }),
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingTicketExemption",
        recordId: exemptionId.toString(),
        action: "UPDATE",
        changedFields: JSON.stringify(changedFields),
        oldValues: JSON.stringify(existingExemption),
        newValues: JSON.stringify(updatedExemption),
        userId: session.user.id,
      },
    });

    return NextResponse.json(updatedExemption);
  } catch (error) {
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

  // Only Admins can delete exemption records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  if (isNaN(exemptionId)) {
    return NextResponse.json(
      { error: "Invalid exemption ID" },
      { status: 400 },
    );
  }

  try {
    // Check if exemption exists
    const existingExemption = await prisma.trainingTicketExemption.findUnique({
      where: { id: exemptionId },
      include: {
        training: true,
        ticket: true,
        employee: true,
      },
    });

    if (!existingExemption) {
      return NextResponse.json(
        { message: "Exemption record not found" },
        { status: 404 },
      );
    }

    // Delete the exemption
    await prisma.trainingTicketExemption.delete({
      where: { id: exemptionId },
    });

    // Log the deletion
    await prisma.history.create({
      data: {
        tableName: "TrainingTicketExemption",
        recordId: exemptionId.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(existingExemption),
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      message: "Exemption record deleted successfully",
      deletedRecord: existingExemption,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting exemption record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
