import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET all employees
export const GET = auth(async function GET(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  // If authenticated, proceed with the original functionality
  try {
    const employees = await prisma.employee.findMany({
      orderBy: {
        lastName: "asc",
      },
    });
    return NextResponse.json(employees);
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
export const POST = auth(async function POST(request) {
  // Check if the user is authenticated
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  try {
    const json = await request.json();
    const employee = await prisma.employee.create({
      data: {
        firstName: json.firstName,
        lastName: json.lastName,
        WorkAreaID: json.WorkAreaID,
        Title: json.Title,
        StartDate: json.StartDate ? new Date(json.StartDate) : null,
        FinishDate: json.FinishDate ? new Date(json.FinishDate) : null,
        Department: json.Department,
        Location: json.Location,
        IsActive: json.IsActive ?? true,
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
