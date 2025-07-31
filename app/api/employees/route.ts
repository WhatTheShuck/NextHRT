import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET all employees
export const GET = auth(async function GET(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = req.auth.user?.role as UserRole;
  const userId = req.auth.user?.id;

  try {
    // Different query based on user role
    if (userRole === "Admin") {
      // Admins can see all employees
      const employees = await prisma.employee.findMany({
        include: {
          department: true,
          location: true,
        },
        orderBy: {
          lastName: "asc",
        },
      });
      return NextResponse.json(employees);
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
      return NextResponse.json(employees);
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

      const employee = await prisma.employee.findUnique({
        where: { id: user.employee.id },
        include: {
          department: true,
          location: true,
        },
      });

      return NextResponse.json([employee]); // Return as array for consistent frontend handling
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching employees",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// POST new employee
export const POST = auth(async function POST(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = req.auth.user?.role as UserRole;

  // Only Admins can create new employees
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await req.json();

    // Check for duplicate detection unless confirmDuplicate flag is set
    if (!json.confirmDuplicate) {
      // Look for potential duplicates based on first and last name
      const potentialDuplicates = await prisma.employee.findMany({
        where: {
          firstName: {
            equals: json.firstName,
          },
          lastName: {
            equals: json.lastName,
          },
        },
        include: {
          department: true,
          location: true,
        },
        orderBy: {
          finishDate: "desc", // Show most recent records first
        },
      });

      // If duplicates found, return 409 with details
      if (potentialDuplicates.length > 0) {
        const suggestions = {
          rehire: potentialDuplicates.some((emp) => !emp.isActive), // True if any inactive employees found
          duplicate: true,
        };

        return NextResponse.json(
          {
            error: "Potential duplicate employee found",
            code: "DUPLICATE_EMPLOYEE",
            matches: potentialDuplicates.map((emp) => ({
              id: emp.id,
              firstName: emp.firstName,
              lastName: emp.lastName,
              title: emp.title,
              department: emp.department || "Unknown",
              location: emp.location || "Unknown",
              isActive: emp.isActive,
              startDate: emp.startDate,
              finishDate: emp.finishDate,
            })),
            suggestions,
          },
          { status: 409 },
        );
      }
    }

    // Create the employee (either no duplicates found or confirmDuplicate is true)
    const employee = await prisma.employee.create({
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
        notes: json.notes,
        usi: json.usi,
        isActive: json.isActive ?? true,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Employee",
        recordId: employee.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(employee),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error creating employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
