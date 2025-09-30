import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET all ticket records
export const GET = auth(async function GET(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = req.auth.user?.role as UserRole;
  const userId = req.auth.user?.id;

  const includeClause: any = {
    training: true,
    ticket: true,
    employee: true,
  };
  const whereClause: any = {};

  try {
    // Different query based on user role
    if (userRole === "Admin") {
      // Admins can see all employee records
      const exemptions = await prisma.trainingTicketExemption.findMany({
        include: includeClause,
        where: whereClause,
      });

      return NextResponse.json(exemptions);
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

      const employees = await prisma.employee.findMany({
        where: {
          departmentId: { in: departmentIds },
        },
        include: {
          department: true,
          location: true,
        },
        orderBy: {
          lastName: "asc",
        },
      });
      const employeeIds = employees.map((emp) => emp.id);
      whereClause.employeeId = { in: employeeIds };

      const exemptions = await prisma.trainingTicketExemption.findMany({
        where: whereClause,
        include: includeClause,
      });
      return NextResponse.json([exemptions]);
    } else {
      // Regular users can only see themselves
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true },
      });

      if (!user || !user.employee) {
        return NextResponse.json(
          { message: "No associated employee record" },
          { status: 403 },
        );
      }

      whereClause.employeeId = user.employee.id;
      const exemptions = await prisma.trainingTicketExemption.findMany({
        where: whereClause,
        include: includeClause,
      });
      return NextResponse.json([exemptions]); // Return as array for consistent frontend handling
    }
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
  const userRole = req.auth.user?.role as UserRole;

  // Only Admins can create employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }
  try {
    const json = await req.json();

    // Basic validation
    if (!json.type || (json.type !== "Ticket" && json.type !== "Training")) {
      return NextResponse.json(
        { error: "Type must be either 'Ticket' or 'Training'" },
        { status: 400 },
      );
    }

    if (!json.employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required" },
        { status: 400 },
      );
    }

    // Validate that the appropriate ID is provided based on type
    if (json.type === "Ticket" && !json.ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required when type is 'Ticket'" },
        { status: 400 },
      );
    }

    if (json.type === "Training" && !json.trainingId) {
      return NextResponse.json(
        { error: "Training ID is required when type is 'Training'" },
        { status: 400 },
      );
    }

    // Date validation
    const startDate = json.startDate ? new Date(json.startDate) : new Date();
    const endDate = json.endDate ? new Date(json.endDate) : null;

    // Validate that dates are valid
    if (json.startDate && isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid start date format" },
        { status: 400 },
      );
    }

    if (json.endDate && isNaN(endDate?.getTime() || 0)) {
      return NextResponse.json(
        { error: "Invalid end date format" },
        { status: 400 },
      );
    }

    // Validate end date is after start date
    if (endDate && endDate <= startDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }

    // Check for existing record
    const whereCondition: any = {
      employeeId: json.employeeId,
    };

    if (json.type === "Ticket") {
      whereCondition.ticketId = json.ticketId;
      whereCondition.trainingId = null;
    } else {
      whereCondition.trainingId = json.trainingId;
      whereCondition.ticketId = null;
    }

    const existingRecord = await prisma.trainingTicketExemption.findFirst({
      where: whereCondition,
    });

    if (existingRecord) {
      return NextResponse.json(
        {
          error: "Duplicate exemption record found",
          code: "DUPLICATE_EXEMPTION_RECORD",
          message: `An exemption record for this employee and ${json.type.toLowerCase()} already exists`,
        },
        { status: 409 },
      );
    }

    // Verify that employee exists (always required)
    const employee = await prisma.employee.findUnique({
      where: { id: json.employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Conditionally verify ticket or training exists based on type
    let ticket = null;
    let training = null;

    if (json.type === "Ticket") {
      ticket = await prisma.ticket.findUnique({
        where: { id: json.ticketId },
      });

      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }
    } else if (json.type === "Training") {
      training = await prisma.training.findUnique({
        where: { id: json.trainingId },
      });

      if (!training) {
        return NextResponse.json(
          { error: "Training not found" },
          { status: 404 },
        );
      }
    }

    // Create the exemption
    const exemption = await prisma.trainingTicketExemption.create({
      data: {
        employeeId: json.employeeId,
        type: json.type,
        ticketId: json.type === "Ticket" ? json.ticketId : null,
        trainingId: json.type === "Training" ? json.trainingId : null,
        reason: json.reason,
        startDate: startDate,
        endDate: endDate,
        status: json.status || "Active",
      },
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingTicketExemption",
        recordId: exemption.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(exemption),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(exemption);
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
