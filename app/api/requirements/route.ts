import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

const getEmployeeRequirements = async (employeeId: number) => {
  try {
    // Fetch the employee to ensure they exist
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    try {
      // Build OR conditions to include:
      // 1. Specific dept + specific location (employee's exact combination)
      // 2. All depts (-1) + employee's location
      // 3. Employee's dept + all locations (-1)
      // 4. All depts (-1) + all locations (-1)
      const whereClause = {
        OR: [
          {
            departmentId: employee.departmentId,
            locationId: employee.locationId,
          }, // Exact match
          { departmentId: -1, locationId: employee.locationId }, // All depts, employee's location
          { departmentId: employee.departmentId, locationId: -1 }, // Employee's dept, all locations
          { departmentId: -1, locationId: -1 }, // All depts, all locations
        ],
      };

      // Fetch training requirements for the employee
      const [trainingRequirements, ticketRequirements, exemptions] =
        await Promise.all([
          prisma.trainingRequirement.findMany({
            where: whereClause,
            include: {
              training: true,
              department: true,
              location: true,
            },
          }),
          prisma.ticketRequirement.findMany({
            where: whereClause,
            include: {
              ticket: true,
              department: true,
              location: true,
            },
          }),
          prisma.trainingTicketExemption.findMany({
            where: { employeeId: employeeId },
            include: {
              training: true,
              ticket: true,
            },
          }),
        ]);

      return NextResponse.json(
        { trainingRequirements, ticketRequirements, exemptions },
        { status: 200 },
      );
    } catch (error) {
      console.error("Error fetching employee requirements:", error);
      return NextResponse.json(
        { error: "Error fetching requirements" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error finding employee:", error);
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
};

const getDepartmentLocationRequirements = async (
  departmentId: number,
  locationId: number,
) => {
  try {
    // Build the where clause to include both specific matches AND "all" (-1) entries
    // This handles cases where requirements are set for:
    // 1. Specific dept + specific location
    // 2. All depts (-1) + specific location
    // 3. Specific dept + all locations (-1)
    // 4. All depts (-1) + all locations (-1)

    const buildWhereClause = (deptId: number, locId: number) => {
      // When querying for specific dept/location, we want:
      // - Requirements for that specific combination
      // - Requirements for "all departments" (-1) + that specific location
      // - Requirements for that specific department + "all locations" (-1)
      // - Requirements for "all departments" (-1) + "all locations" (-1)

      const conditions = [];

      if (deptId === -1 && locId === -1) {
        // Requesting all - return everything
        return {};
      } else if (deptId === -1) {
        // All departments, specific location
        conditions.push(
          { departmentId: -1, locationId: locId },
          { departmentId: -1, locationId: -1 },
        );
      } else if (locId === -1) {
        // Specific department, all locations
        conditions.push(
          { departmentId: deptId, locationId: -1 },
          { departmentId: -1, locationId: -1 },
        );
      } else {
        // Specific department and location
        conditions.push(
          { departmentId: deptId, locationId: locId }, // Exact match
          { departmentId: -1, locationId: locId }, // All depts, this location
          { departmentId: deptId, locationId: -1 }, // This dept, all locations
          { departmentId: -1, locationId: -1 }, // All depts, all locations
        );
      }

      return { OR: conditions };
    };

    const whereClause = buildWhereClause(departmentId, locationId);

    // Validate that the specified department and location exist (if not -1)
    const validationPromises = [];

    if (departmentId !== -1) {
      validationPromises.push(
        prisma.department.findUnique({
          where: { id: departmentId },
        }),
      );
    } else {
      validationPromises.push(Promise.resolve(true)); // Skip validation for -1
    }

    if (locationId !== -1) {
      validationPromises.push(
        prisma.location.findUnique({
          where: { id: locationId },
        }),
      );
    } else {
      validationPromises.push(Promise.resolve(true)); // Skip validation for -1
    }

    const [department, location] = await Promise.all(validationPromises);

    // Check if specified entities exist
    if (departmentId !== -1 && !department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    if (locationId !== -1 && !location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    try {
      // Fetch requirements based on the where clause
      const [trainingRequirements, ticketRequirements] = await Promise.all([
        prisma.trainingRequirement.findMany({
          where: whereClause,
          include: {
            training: true,
            department: true,
            location: true,
          },
        }),
        prisma.ticketRequirement.findMany({
          where: whereClause,
          include: {
            ticket: true,
            department: true,
            location: true,
          },
        }),
      ]);

      return NextResponse.json(
        {
          trainingRequirements,
          ticketRequirements,
          filters: {
            departmentId: departmentId === -1 ? "all" : departmentId,
            locationId: locationId === -1 ? "all" : locationId,
          },
        },
        { status: 200 },
      );
    } catch (error) {
      console.error("Error fetching department/location requirements:", error);
      return NextResponse.json(
        { error: "Error fetching requirements" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in getDepartmentLocationRequirements:", error);
    return NextResponse.json(
      { error: "Error processing request" },
      { status: 500 },
    );
  }
};

export const GET = auth(async function GET(
  request,
  props: { params: Promise<{}> },
) {
  // Check if the user is authenticated
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const departmentIdParam = searchParams.get("departmentId");
  const locationIdParam = searchParams.get("locationId");
  const employeeIdParam = searchParams.get("employeeId");

  // Handle individual employee requirements
  if (employeeIdParam) {
    const employeeId = parseInt(employeeIdParam);
    if (isNaN(employeeId)) {
      return NextResponse.json(
        { error: "Invalid employeeId parameter" },
        { status: 400 },
      );
    }
    return getEmployeeRequirements(employeeId);
  }

  // Handle department/location requirements
  if (departmentIdParam !== null && locationIdParam !== null) {
    const departmentId = parseInt(departmentIdParam);
    const locationId = parseInt(locationIdParam);

    if (isNaN(departmentId) || isNaN(locationId)) {
      return NextResponse.json(
        { error: "Invalid departmentId or locationId parameter" },
        { status: 400 },
      );
    }

    return getDepartmentLocationRequirements(departmentId, locationId);
  }

  return NextResponse.json(
    {
      error:
        "Missing required parameters. Provide either employeeId, or both departmentId and locationId",
    },
    { status: 400 },
  );
});
