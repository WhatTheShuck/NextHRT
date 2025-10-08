import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";

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
      const [
        allTrainingRequirements,
        allTicketRequirements,
        exemptions,
        trainingRecords,
        ticketRecords,
      ] = await Promise.all([
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
        prisma.trainingRecords.findMany({
          where: { employeeId: employeeId },
        }),
        prisma.ticketRecords.findMany({
          where: { employeeId: employeeId },
        }),
      ]);

      // Compare requirements against completed records
      // remove any requirements that have been completed
      const trainingRequired = allTrainingRequirements.filter((req) => {
        return !trainingRecords.some(
          (record) => record.trainingId === req.trainingId,
        );
      });
      const ticketRequired = allTicketRequirements.filter((req) => {
        return !ticketRecords.some(
          (record) => record.ticketId === req.ticketId,
        );
      });

      return NextResponse.json(
        {
          allTrainingRequirements,
          allTicketRequirements,
          exemptions,
          trainingRequired,
          ticketRequired,
        },
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

const getTrainingRequirements = async (trainingId: number) => {
  try {
    // Fetch the training to ensure it exists
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
    });

    if (!training) {
      return NextResponse.json(
        { error: "Training not found" },
        { status: 404 },
      );
    }

    // Fetch training requirements for this training
    const requirements = await prisma.trainingRequirement.findMany({
      where: { trainingId: trainingId },
      include: {
        department: true,
        location: true,
      },
    });

    if (!requirements || requirements.length === 0) {
      return NextResponse.json(
        { error: "No requirements found for this training" },
        { status: 404 },
      );
    }

    // Determine which employees need this training based on requirements
    const allDepartments = requirements.some((req) => req.departmentId === -1);
    const allLocations = requirements.some((req) => req.locationId === -1);

    let requiredDepartmentIds: number[] = [];
    let requiredLocationIds: number[] = [];

    // Build department filter
    if (allDepartments) {
      // If any requirement applies to all departments, we need all departments
      const allDepts = await prisma.department.findMany({
        select: { id: true },
      });
      requiredDepartmentIds = allDepts.map((dept) => dept.id);
    } else {
      // Only specific departments
      requiredDepartmentIds = [
        ...new Set(
          requirements.map((req) => req.departmentId).filter((id) => id !== -1),
        ),
      ];
    }

    // Build location filter
    if (allLocations) {
      // If any requirement applies to all locations, we need all locations
      const allLocs = await prisma.location.findMany({
        select: { id: true },
      });
      requiredLocationIds = allLocs.map((loc) => loc.id);
    } else {
      // Only specific locations
      requiredLocationIds = [
        ...new Set(
          requirements.map((req) => req.locationId).filter((id) => id !== -1),
        ),
      ];
    }

    // Fetch ALL employees first
    const allEmployees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },
      include: {
        department: true,
        location: true,
      },
    });

    // Filter employees who match at least one requirement set
    const requiredEmployees = allEmployees.filter((employee) => {
      return requirements.some((req) => {
        // Check if this employee matches this specific requirement
        const deptMatches =
          req.departmentId === -1 || req.departmentId === employee.departmentId;
        const locMatches =
          req.locationId === -1 || req.locationId === employee.locationId;

        // Both must match for this requirement to apply
        return deptMatches && locMatches;
      });
    });

    // Fetch training records for this training
    const trainingRecords = await prisma.trainingRecords.findMany({
      where: {
        trainingId: trainingId,
        employeeId: { in: requiredEmployees.map((emp) => emp.id) },
      },
    });

    // Fetch exemptions for this training
    const exemptions = await prisma.trainingTicketExemption.findMany({
      where: {
        trainingId: trainingId,
        employeeId: { in: requiredEmployees.map((emp) => emp.id) },
      },
      include: {
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
      },
    });

    // Create a set of employee IDs who have completed the training
    const completedEmployeeIds = new Set(
      trainingRecords.map((record) => record.employeeId),
    );

    // Create a set of employee IDs who have exemptions
    const exemptEmployeeIds = new Set(
      exemptions.map((exemption) => exemption.employeeId),
    );

    // Map employees to include requirementStatus
    const employeesWithStatus = requiredEmployees.map((emp) => {
      let requirementStatus: "Required" | "Exempted" | "Completed";

      if (exemptEmployeeIds.has(emp.id)) {
        requirementStatus = "Exempted";
      } else if (completedEmployeeIds.has(emp.id)) {
        requirementStatus = "Completed";
      } else {
        requirementStatus = "Required";
      }

      return {
        ...emp,
        requirementStatus,
      };
    });

    return NextResponse.json(
      {
        employees: employeesWithStatus,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching training requirements:", error);
    return NextResponse.json(
      { error: "Error fetching training requirements" },
      { status: 500 },
    );
  }
};

const getTicketRequirements = async (ticketId: number) => {
  try {
    // Fetch the ticket to ensure it exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Training not found" },
        { status: 404 },
      );
    }

    // Fetch ticket requirements for this ticket
    const requirements = await prisma.ticketRequirement.findMany({
      where: { ticketId: ticketId },
      include: {
        department: true,
        location: true,
      },
    });

    if (!requirements || requirements.length === 0) {
      return NextResponse.json(
        { error: "No requirements found for this ticket" },
        { status: 404 },
      );
    }

    // Determine which employees need this ticket based on requirements
    const allDepartments = requirements.some((req) => req.departmentId === -1);
    const allLocations = requirements.some((req) => req.locationId === -1);

    let requiredDepartmentIds: number[] = [];
    let requiredLocationIds: number[] = [];

    // Build department filter
    if (allDepartments) {
      // If any requirement applies to all departments, we need all departments
      const allDepts = await prisma.department.findMany({
        select: { id: true },
      });
      requiredDepartmentIds = allDepts.map((dept) => dept.id);
    } else {
      // Only specific departments
      requiredDepartmentIds = [
        ...new Set(
          requirements.map((req) => req.departmentId).filter((id) => id !== -1),
        ),
      ];
    }

    // Build location filter
    if (allLocations) {
      // If any requirement applies to all locations, we need all locations
      const allLocs = await prisma.location.findMany({
        select: { id: true },
      });
      requiredLocationIds = allLocs.map((loc) => loc.id);
    } else {
      // Only specific locations
      requiredLocationIds = [
        ...new Set(
          requirements.map((req) => req.locationId).filter((id) => id !== -1),
        ),
      ];
    }

    // Fetch ALL employees first
    const allEmployees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },
      include: {
        department: true,
        location: true,
      },
    });

    // Filter employees who match at least one requirement set
    const requiredEmployees = allEmployees.filter((employee) => {
      return requirements.some((req) => {
        // Check if this employee matches this specific requirement
        const deptMatches =
          req.departmentId === -1 || req.departmentId === employee.departmentId;
        const locMatches =
          req.locationId === -1 || req.locationId === employee.locationId;

        // Both must match for this requirement to apply
        return deptMatches && locMatches;
      });
    });

    // Fetch ticket records for this ticket
    const ticketRecords = await prisma.ticketRecords.findMany({
      where: {
        ticketId: ticketId,
        employeeId: { in: requiredEmployees.map((emp) => emp.id) },
      },
    });

    // Fetch exemptions for this ticket
    const exemptions = await prisma.trainingTicketExemption.findMany({
      where: {
        ticketId: ticketId,
        employeeId: { in: requiredEmployees.map((emp) => emp.id) },
      },
      include: {
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
      },
    });

    // Create a set of employee IDs who have completed the ticket
    const completedEmployeeIds = new Set(
      ticketRecords.map((record) => record.employeeId),
    );

    // Create a set of employee IDs who have exemptions
    const exemptEmployeeIds = new Set(
      exemptions.map((exemption) => exemption.employeeId),
    );

    // Map employees to include requirementStatus
    const employeesWithStatus = requiredEmployees.map((emp) => {
      let requirementStatus: "Required" | "Exempted" | "Completed";

      if (exemptEmployeeIds.has(emp.id)) {
        requirementStatus = "Exempted";
      } else if (completedEmployeeIds.has(emp.id)) {
        requirementStatus = "Completed";
      } else {
        requirementStatus = "Required";
      }

      return {
        ...emp,
        requirementStatus,
      };
    });

    return NextResponse.json(
      {
        employees: employeesWithStatus,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching ticket requirements:", error);
    return NextResponse.json(
      { error: "Error fetching training requirements" },
      { status: 500 },
    );
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

const getAllIncompleteTrainingRequirements = async () => {
  try {
    // Step 1: Get all training that have at least one requirement
    const trainingWithRequirements = await prisma.trainingRequirement.findMany({
      select: {
        trainingId: true,
      },
      distinct: ["trainingId"],
    });

    const trainingIds = trainingWithRequirements.map((req) => req.trainingId);

    if (trainingIds.length === 0) {
      return NextResponse.json({ employees: [] }, { status: 200 });
    }

    // Step 2: Get all requirements for these training courses
    const allRequirements = await prisma.trainingRequirement.findMany({
      where: {
        trainingId: { in: trainingIds },
      },
      include: {
        training: true,
        department: true,
        location: true,
      },
    });

    // Step 3: Get all active employees
    const allEmployees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },
      include: {
        department: true,
        location: true,
      },
    });

    // Step 4: Get all training records and exemptions
    const [allTrainingRecords, allExemptions] = await Promise.all([
      prisma.trainingRecords.findMany({
        where: {
          trainingId: { in: trainingIds },
        },
      }),
      prisma.trainingTicketExemption.findMany({
        where: {
          trainingId: { in: trainingIds },
        },
      }),
    ]);

    // Create lookup maps for performance
    const completedMap = new Map<number, Set<number>>();
    allTrainingRecords.forEach((record) => {
      if (!completedMap.has(record.employeeId)) {
        completedMap.set(record.employeeId, new Set());
      }
      completedMap.get(record.employeeId)!.add(record.trainingId);
    });

    const exemptionMap = new Map<number, Set<number>>();
    allExemptions.forEach((exemption) => {
      if (exemption.trainingId) {
        if (!exemptionMap.has(exemption.employeeId)) {
          exemptionMap.set(exemption.employeeId, new Set());
        }
        exemptionMap.get(exemption.employeeId)!.add(exemption.trainingId);
      }
    });

    // Step 5: For each employee, determine what training they need
    // Return one row per employee per incomplete training for easy table display
    const rows: any[] = [];

    allEmployees.forEach((employee) => {
      // Find all training required for this employee
      const requiredTrainingIds = new Set<number>();

      allRequirements.forEach((req) => {
        const deptMatches =
          req.departmentId === -1 || req.departmentId === employee.departmentId;
        const locMatches =
          req.locationId === -1 || req.locationId === employee.locationId;

        if (deptMatches && locMatches) {
          requiredTrainingIds.add(req.trainingId);
        }
      });

      // Filter out completed and exempted training
      const incompleteTraining = Array.from(requiredTrainingIds).filter(
        (trainingId) => {
          const isCompleted =
            completedMap.get(employee.id)?.has(trainingId) ?? false;
          const isExempt =
            exemptionMap.get(employee.id)?.has(trainingId) ?? false;
          return !isCompleted && !isExempt;
        },
      );

      // Create one row per incomplete training
      incompleteTraining.forEach((trainingId) => {
        const requirement = allRequirements.find(
          (req) => req.trainingId === trainingId,
        );
        rows.push({
          employeeId: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department,
          location: employee.location,
          trainingName: requirement?.training.title,
        });
      });
    });

    return NextResponse.json(
      {
        employees: rows,
        totalRows: rows.length,
        uniqueEmployees: new Set(rows.map((r) => r.employeeId)).size,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching incomplete training requirements:", error);
    return NextResponse.json(
      { error: "Error fetching incomplete training requirements" },
      { status: 500 },
    );
  }
};

const getAllIncompleteTicketRequirements = async () => {
  try {
    // Step 1: Get all tickets that have at least one requirement
    const ticketsWithRequirements = await prisma.ticketRequirement.findMany({
      select: {
        ticketId: true,
      },
      distinct: ["ticketId"],
    });

    const ticketIds = ticketsWithRequirements.map((req) => req.ticketId);

    if (ticketIds.length === 0) {
      return NextResponse.json({ employees: [] }, { status: 200 });
    }

    // Step 2: Get all requirements for these tickets
    const allRequirements = await prisma.ticketRequirement.findMany({
      where: {
        ticketId: { in: ticketIds },
      },
      include: {
        ticket: true,
        department: true,
        location: true,
      },
    });

    // Step 3: Get all active employees
    const allEmployees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },
      include: {
        department: true,
        location: true,
      },
    });

    // Step 4: Get all ticket records and exemptions
    const [allTicketRecords, allExemptions] = await Promise.all([
      prisma.ticketRecords.findMany({
        where: {
          ticketId: { in: ticketIds },
        },
      }),
      prisma.trainingTicketExemption.findMany({
        where: {
          ticketId: { in: ticketIds },
        },
      }),
    ]);

    // Create lookup maps for performance
    const completedMap = new Map<number, Set<number>>();
    allTicketRecords.forEach((record) => {
      if (!completedMap.has(record.employeeId)) {
        completedMap.set(record.employeeId, new Set());
      }
      completedMap.get(record.employeeId)!.add(record.ticketId);
    });

    const exemptionMap = new Map<number, Set<number>>();
    allExemptions.forEach((exemption) => {
      if (exemption.ticketId) {
        if (!exemptionMap.has(exemption.employeeId)) {
          exemptionMap.set(exemption.employeeId, new Set());
        }
        exemptionMap.get(exemption.employeeId)!.add(exemption.ticketId);
      }
    });

    // Step 5: For each employee, determine what tickets they need
    // Return one row per employee per incomplete ticket for easy table display
    const rows: any[] = [];

    allEmployees.forEach((employee) => {
      // Find all tickets required for this employee
      const requiredTicketIds = new Set<number>();

      allRequirements.forEach((req) => {
        const deptMatches =
          req.departmentId === -1 || req.departmentId === employee.departmentId;
        const locMatches =
          req.locationId === -1 || req.locationId === employee.locationId;

        if (deptMatches && locMatches) {
          requiredTicketIds.add(req.ticketId);
        }
      });

      // Filter out completed and exempted tickets
      const incompleteTickets = Array.from(requiredTicketIds).filter(
        (ticketId) => {
          const isCompleted =
            completedMap.get(employee.id)?.has(ticketId) ?? false;
          const isExempt =
            exemptionMap.get(employee.id)?.has(ticketId) ?? false;
          return !isCompleted && !isExempt;
        },
      );

      // Create one row per incomplete ticket
      incompleteTickets.forEach((ticketId) => {
        const requirement = allRequirements.find(
          (req) => req.ticketId === ticketId,
        );
        rows.push({
          employeeId: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department,
          location: employee.location,
          ticketName: requirement?.ticket.ticketName,
        });
      });
    });

    return NextResponse.json(
      {
        employees: rows,
        totalRows: rows.length,
        uniqueEmployees: new Set(rows.map((r) => r.employeeId)).size,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching incomplete ticket requirements:", error);
    return NextResponse.json(
      { error: "Error fetching incomplete ticket requirements" },
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
  const trainingIdParam = searchParams.get("trainingId");
  const ticketIdParam = searchParams.get("ticketId");
  const allIncompleteTraining = searchParams.get("allIncompleteTraining");
  const allIncompleteTickets = searchParams.get("allIncompleteTickets");

  // Handle bulk incomplete training
  if (allIncompleteTraining === "true") {
    return getAllIncompleteTrainingRequirements();
  }

  // Handle bulk incomplete tickets
  if (allIncompleteTickets === "true") {
    return getAllIncompleteTicketRequirements();
  }
  // Handle individual employee requirements
  if (employeeIdParam) {
    const employeeId = parseInt(employeeIdParam);
    if (isNaN(employeeId)) {
      return NextResponse.json(
        { error: "Invalid employeeId parameter" },
        { status: 400 },
      );
    }

    const hasAccess = await hasAccessToEmployee(
      request.auth.user.id,
      employeeId,
      request.auth.user.role,
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to view this employee" },
        { status: 403 },
      );
    }
    return getEmployeeRequirements(employeeId);
  }

  if (trainingIdParam) {
    const trainingId = parseInt(trainingIdParam);
    if (isNaN(trainingId)) {
      return NextResponse.json(
        { error: "Invalid trainingId parameter" },
        { status: 400 },
      );
    }

    // Fetch training requirement by trainingId
    return getTrainingRequirements(trainingId);
  }
  if (ticketIdParam) {
    const ticketId = parseInt(ticketIdParam);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: "Invalid trainingId parameter" },
        { status: 400 },
      );
    }

    // Fetch training requirement by trainingId
    return getTicketRequirements(ticketId);
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
