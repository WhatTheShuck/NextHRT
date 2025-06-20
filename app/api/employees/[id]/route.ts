import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";

// GET single employee
export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userId = request.auth.user?.id;
  const userRole = request.auth.user?.role as UserRole;
  const employeeId = parseInt(params.id);

  try {
    // Check if user has access to this employee
    const hasAccess = await hasAccessToEmployee(userId, employeeId, userRole);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorized to view this employee" },
        { status: 403 },
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        location: true,
        trainingRecords: {
          include: {
            training: true,
          },
        },
        ticketRecords: {
          include: {
            ticket: true,
          },
        },
        User: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PUT update employee
export const PUT = auth(async function PUT(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userId = request.auth.user?.id;
  const userRole = request.auth.user?.role as UserRole;
  const employeeId = parseInt(params.id);

  try {
    // Check if user has access to this employee
    const hasAccess = await hasAccessToEmployee(userId, employeeId, userRole);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorized to update this employee" },
        { status: 403 },
      );
    }

    // Get current employee data for history
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!currentEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const json = await request.json();

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        firstName: json.firstName,
        lastName: json.lastName,
        title: json.title,
        startDate: json.startDate ? new Date(json.startDate) : null,
        finishDate: json.finishDate ? new Date(json.finishDate) : null,
        department: {
          connect: { id: json.departmentId },
        },
        location: {
          connect: { id: json.locationId },
        },
        businessArea: json.businessArea,
        job: json.job,
        notes: json.notes,
        usi: json.usi,
        isActive: json.isActive ?? true,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Employee",
        recordId: employeeId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentEmployee),
        newValues: JSON.stringify(updatedEmployee),
        userId: userId,
      },
    });

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// DELETE employee
export const DELETE = auth(async function DELETE(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userId = request.auth.user?.id;
  const userRole = request.auth.user?.role as UserRole;
  const employeeId = parseInt(params.id);

  // Only Admins can delete employees
  if (userRole !== "Admin") {
    return NextResponse.json(
      { error: "Only administrators can delete employees" },
      { status: 403 },
    );
  }

  try {
    // Get current employee data for history
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!currentEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // First delete related records to avoid foreign key constraints
    await prisma.$transaction([
      prisma.trainingRecords.deleteMany({
        where: { employeeId: employeeId },
      }),
      prisma.ticketRecords.deleteMany({
        where: { employeeId: employeeId },
      }),
      // Check if there's a user associated with this employee
      prisma.user.updateMany({
        where: { employeeId: employeeId },
        data: { employeeId: null },
      }),
      // Create history record
      prisma.history.create({
        data: {
          tableName: "Employee",
          recordId: employeeId,
          action: "DELETE",
          oldValues: JSON.stringify(currentEmployee),
          userId: userId,
        },
      }),
      // Finally delete the employee
      prisma.employee.delete({
        where: { id: employeeId },
      }),
    ]);

    return NextResponse.json({ message: "Employee deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
